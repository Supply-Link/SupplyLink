import { useLocalSearchParams, useRouter } from '@/navigation/router';
import { CircleX, FileText, MapPin, Package, RefreshCw, RotateCcw } from 'lucide-react-native';
import { Alert, Text, View } from 'react-native';
import { StageBadge, Timeline, Totals } from '@/components/orders';
import { Body, Button, Card, colors, EmptyState, Muted, Screen, Title } from '@/components/ui';
import { cancellable, dateTime, money, percent, stageLabel } from '@/lib/rules';
import { stateName } from '@/lib/states';
import { useSession } from '@/session/SessionProvider';

export default function OrderScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { workspace, request, refresh } = useSession();
  const order = workspace?.orders.find((o) => o.id === id);

  if (!order) {
    return (
      <Screen title="Order" onBack={router.back} bottomInset>
        <EmptyState message="This order is no longer available." />
      </Screen>
    );
  }

  const latest = order.tracking.at(-1);

  const confirmCancel = () =>
    Alert.alert(`Cancel ${order.number}?`, 'Reserved stock and trade credit will be released.', [
      { text: 'Keep order', style: 'cancel' },
      {
        text: 'Cancel order',
        style: 'destructive',
        onPress: async () => {
          if (await request('POST', `/api/orders/${order.id}`, { status: 'cancelled' })) await refresh();
        },
      },
    ]);

  return (
    <Screen title={order.number} subtitle={stageLabel(order.status)} onBack={router.back} onRefresh={refresh} bottomInset>
      <Card>
        <Title>{order.retailer_name}</Title>
        <StageBadge status={order.status} />
        <Body>{order.address}</Body>
        <Muted className="text-sm">
          Payment: {order.payment_method === 'cod' ? 'Cash on delivery' : 'Trade credit'} · {order.payment_status}
        </Muted>
        <Muted>
          Place of supply: {stateName(order.supply_state_code)}
          {order.tax_type ? ` · ${order.tax_type}` : ''}
        </Muted>
      </Card>

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
            <Muted className="text-xs">Batch details are unavailable for this legacy order.</Muted>
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

      {order.proof_of_delivery ? <Card><Title>Proof of delivery</Title><Body>Received by {order.proof_of_delivery.recipient_name}</Body><Muted>{dateTime(order.proof_of_delivery.captured_at)}</Muted></Card> : null}

      <Button title="View transaction record" icon={FileText} variant="secondary" onPress={() => router.push({ pathname: '/statement/[id]', params: { id: order.id } })} />
      {order.status === 'delivered' ? <Button title={order.return_request ? `Return ${order.return_request.status}` : 'Request a return'} icon={RotateCcw} variant="secondary" onPress={() => router.push({ pathname: '/return/[id]', params: { id: order.id } })} /> : null}

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

      {cancellable(order.status, order.payment_status) ? (
        <Button title="Cancel order" icon={CircleX} variant="danger" onPress={confirmCancel} />
      ) : null}
      <Button title="Refresh order" icon={RefreshCw} variant="secondary" onPress={refresh} />
    </Screen>
  );
}
