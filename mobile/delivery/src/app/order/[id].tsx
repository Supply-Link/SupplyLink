// Order detail screen — full delivery view with DeliveryActions:
// GPS/manual location share, signature capture navigation, and cash collection.

import { useLocalSearchParams, useRouter } from '@/navigation/router';
import { Banknote, MapPin, Navigation, Package, PackageCheck, PencilLine, RefreshCw, Route } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import { StageBadge, Timeline, Totals } from '@/components/orders';
import { Body, Button, Card, colors, Dialog, EmptyState, Field, Muted, Screen, Title } from '@/components/ui';
import { currentFix } from '@/lib/location';
import { coordinate, dateTime, money, percent, stageLabel } from '@/lib/rules';
import { stateName } from '@/lib/states';
import type { Order } from '@/lib/types';
import { isQueued, useSession } from '@/session/SessionProvider';
import { useToast } from '@/session/ToastProvider';

export default function OrderScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { workspace, refresh } = useSession();
  const order = workspace?.orders.find((o) => o.id === id);

  if (!order) {
    return (
      <Screen title="Delivery" onBack={router.back} bottomInset>
        <EmptyState message="This delivery is no longer assigned to you." />
      </Screen>
    );
  }

  const latest = order.tracking.at(-1);

  return (
    <Screen title={order.number} subtitle={stageLabel(order.status)} onBack={router.back} onRefresh={refresh} bottomInset>
      <Card>
        <Title>{order.retailer_name}</Title>
        <StageBadge status={order.status} />
        <Body>{order.address}</Body>
        {order.status === 'out_for_delivery' && order.address ? (
          <Button
            title="Navigate to address"
            icon={Route}
            variant="secondary"
            onPress={() => void Linking.openURL(`geo:0,0?q=${encodeURIComponent(order.address)}`)}
          />
        ) : null}
        {order.payment_method === 'cod' && order.payment_status !== 'paid' && order.status !== 'cancelled' ? (
          <View className="mt-3 flex-row items-center rounded-xl bg-brand-accent/60 px-3 py-2.5">
            <Banknote size={18} color={colors.brand} />
            <Text className="ml-2 flex-1 text-[15px] font-bold text-brand">Collect {money(order.total)} in cash</Text>
          </View>
        ) : (
          <Muted className="text-sm">
            Payment: {order.payment_method === 'cod' ? 'Cash on delivery' : 'Trade credit'} · {order.payment_status}
          </Muted>
        )}
        <Muted>
          Place of supply: {stateName(order.supply_state_code)}
          {order.tax_type ? ` · ${order.tax_type}` : ''}
        </Muted>
      </Card>

      <DeliveryActions order={order} />

      {order.lines.map((line) => (
        <Card key={line.product_id}>
          <Text className="text-[17px] font-bold text-ink">{line.name}</Text>
          <Muted className="text-sm">
            {line.quantity} × {money(line.unit_price)} · {line.unit}
          </Muted>
          {line.gst_rate_bps !== undefined ? (
            <Muted>
              HSN {line.hsn_code} · GST {percent(line.gst_rate_bps)} · Tax {money(line.tax)}
            </Muted>
          ) : null}
          {line.batches?.length ? (
            line.batches.map((batch) => (
              <View key={batch.batch_number} className="mt-2 flex-row rounded-xl bg-canvas px-3 py-2">
                <Package size={15} color={colors.brand} style={{ marginTop: 2 }} />
                <Text className="ml-2 flex-1 text-[13px] text-ink">
                  {batch.batch_number} · Exp {batch.expiry_date} · Qty {batch.quantity}
                  {'\n'}MRP {money(batch.mrp)} incl. GST
                </Text>
              </View>
            ))
          ) : (
            <Muted className="text-xs">No batch details were recorded for this item.</Muted>
          )}
        </Card>
      ))}

      <Card>
        <Totals totals={order} />
      </Card>

      <Card>
        <Title>Order timeline</Title>
        <Timeline history={order.history} />
      </Card>

      {order.proof_of_delivery ? (
        <Card>
          <Title>Proof of delivery</Title>
          <Body>Received by {order.proof_of_delivery.recipient_name}</Body>
          <Muted>{dateTime(order.proof_of_delivery.captured_at)}</Muted>
        </Card>
      ) : null}

      {latest ? (
        <Card>
          <View className="flex-row items-center">
            <MapPin size={16} color={colors.brand} />
            <Text className="ml-2 text-base font-bold text-ink">Latest shared location</Text>
          </View>
          <Body className="text-sm">
            {latest.latitude}, {latest.longitude}
          </Body>
          <Muted className="text-xs">{dateTime(latest.at)}</Muted>
        </Card>
      ) : null}

      <Button title="Refresh order" icon={RefreshCw} variant="secondary" onPress={refresh} />
    </Screen>
  );
}

function DeliveryActions({ order }: { order: Order }) {
  const router = useRouter();
  const toast = useToast();
  const { request, refresh, keyFor, dropKey, showError, busy, pending } = useSession();
  const [manualOpen, setManualOpen] = useState(false);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [reference, setReference] = useState('');
  const [locating, setLocating] = useState(false);

  const confirmLocation = (lat: number, lon: number, source: string) =>
    Alert.alert(
      'Share this location?',
      `${source}\n${lat}, ${lon}\nThis point will be visible to the retailer and distributor for this order.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Share',
          onPress: async () => {
            const sent = await request(
              'POST',
              '/api/tracking',
              { order_id: order.id, latitude: lat, longitude: lon },
              { idempotencyKey: keyFor(`track:${order.id}:${lat},${lon}`), queue: { label: `Location · ${order.number}`, orderId: order.id } },
            );
            if (!sent) return;
            if (isQueued(sent)) {
              toast("Saved. It will be sent when you're back online.");
              return;
            }
            toast('Location shared.');
            await refresh();
          },
        },
      ],
    );

  const shareCurrent = async () => {
    setLocating(true);
    const fix = await currentFix(() => toast('Finding your location…'));
    setLocating(false);
    if (typeof fix === 'string') toast(fix);
    else confirmLocation(fix.latitude, fix.longitude, fix.source);
  };

  const reviewManual = () => {
    try {
      const lat = coordinate(latitude, 90);
      const lon = coordinate(longitude, 180);
      setManualOpen(false);
      confirmLocation(lat, lon, 'Manually entered coordinates');
    } catch (error) {
      showError((error as Error).message);
    }
  };

  const recordCollection = async () => {
    const ref = reference.trim();
    if (!ref) {
      showError('A receipt or payment reference is required.');
      return;
    }
    const scope = `collection:${order.id}`;
    setCollectionOpen(false);
    const payment = await request(
      'POST',
      '/api/payments',
      { order_id: order.id, amount: order.total, reference: ref },
      { idempotencyKey: keyFor(scope), queue: { label: `Collection · ${order.number}`, orderId: order.id } },
    );
    if (!payment) return;
    setReference('');
    if (isQueued(payment)) {
      toast("Saved. It will be recorded when you're back online.");
      return;
    }
    dropKey(scope);
    toast('Collection recorded.');
    await refresh();
  };

  const outForDelivery = order.status === 'out_for_delivery';
  const awaitingCollection = order.status === 'delivered' && order.payment_status !== 'paid';
  if (!outForDelivery && !awaitingCollection) return null;

  const waiting = pending.filter((item) => item.orderId === order.id && item.path !== '/api/tracking');
  if (waiting.length > 0)
    return (
      <Card>
        <Title className="text-base">Waiting to sync</Title>
        <Muted>
          {waiting.map((item) => item.label).join(', ')} {waiting.length === 1 ? 'is' : 'are'} saved on this phone and will be sent
          automatically when you're back online.
        </Muted>
      </Card>
    );

  return (
    <>
      {outForDelivery ? (
        <Card>
          <Title className="text-base">On the road</Title>
          <Muted>Location is shared once, only after you confirm it. Nothing is tracked in the background.</Muted>
          <Button
            title={locating ? 'Finding location…' : 'Share current location'}
            icon={Navigation}
            disabled={locating || busy}
            onPress={shareCurrent}
          />
          <Button title="Enter location manually" icon={PencilLine} variant="secondary" onPress={() => setManualOpen(true)} />
          <Button title="Capture signature & deliver" icon={PackageCheck} disabled={busy} onPress={() => router.push({ pathname: '/proof/[id]', params: { id: order.id } })} />
        </Card>
      ) : null}

      {awaitingCollection ? (
        <Button
          title={`Record collection · ${money(order.total)}`}
          icon={Banknote}
          disabled={busy}
          onPress={() => setCollectionOpen(true)}
        />
      ) : null}

      <Dialog
        visible={manualOpen}
        title="Share delivery location"
        confirmLabel="Review"
        onCancel={() => setManualOpen(false)}
        onConfirm={reviewManual}
      >
        <Field label="Latitude" value={latitude} onChangeText={setLatitude} keyboardType="numbers-and-punctuation" />
        <Field label="Longitude" value={longitude} onChangeText={setLongitude} keyboardType="numbers-and-punctuation" />
      </Dialog>

      <Dialog
        visible={collectionOpen}
        title={`Collection · ${money(order.total)}`}
        message="Record the full amount already collected. This does not charge a bank account."
        confirmLabel="Record"
        onCancel={() => setCollectionOpen(false)}
        onConfirm={recordCollection}
      >
        <Field label="Receipt / payment reference" value={reference} onChangeText={setReference} autoCapitalize="characters" />
      </Dialog>
    </>
  );
}
