// Medicine detail screen — full product spec, batch list,
// and add-to-basket action.

import { useLocalSearchParams, useRouter } from '@/navigation/router';
import { Package, Plus } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { Body, Button, Card, colors, EmptyState, Muted, Row, Screen, SectionLabel, Title } from '@/components/ui';
import { money, percent } from '@/lib/rules';
import { useCart } from '@/session/CartProvider';
import { useSession } from '@/session/SessionProvider';

export default function MedicineScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { workspace } = useSession();
  const cart = useCart();
  const product = workspace?.products.find((p) => p.id === id);

  if (!product) {
    return (
      <Screen title="Medicine details" onBack={router.back} bottomInset>
        <EmptyState message="This medicine is no longer available." />
      </Screen>
    );
  }

  const batches = product.batches ?? [];

  return (
    <Screen title="Medicine details" subtitle={product.name} onBack={router.back} bottomInset>
      <Card>
        <Title className="text-[23px]">{product.name}</Title>
        <Body className="text-base">
          {product.generic_name} · {product.strength}
        </Body>
        <Muted className="text-sm">
          {product.manufacturer}
          {'\n'}
          {product.unit}
          {product.storage_conditions ? `\n${product.storage_conditions}` : ''}
        </Muted>
        <View className="mt-2">
          <Row label="Price (excl. GST)" value={money(product.price)} />
          <Row label="HSN" value={product.hsn_code ?? '—'} />
          <Row label="GST" value={percent(product.gst_rate_bps)} />
          <Row label="Available" value={`${product.stock} packs`} />
        </View>
      </Card>

      <SectionLabel>Batches</SectionLabel>
      {batches.length === 0 ? <EmptyState message="No batch stock has been received yet." /> : null}
      {batches.map((b) => (
        <Card key={b.id}>
          <View className="flex-row items-center">
            <Package size={16} color={colors.brand} />
            <Text className="ml-2 flex-1 text-[17px] font-bold text-ink">Batch {b.batch_number}</Text>
            <Text className="text-xs font-semibold uppercase text-muted">{b.status.replace('_', ' ')}</Text>
          </View>
          <Muted className="text-sm">
            Expiry {b.expiry_date} · Manufactured {b.manufacturing_date}
            {'\n'}MRP {money(b.mrp)} (incl. GST) · Stock {b.stock}
          </Muted>
        </Card>
      ))}

      {product.stock > 0 ? <Button title="Add to basket" icon={Plus} onPress={() => cart.add(product)} /> : null}
      <Button title="Back to medicines" variant="secondary" onPress={router.back} />
    </Screen>
  );
}
