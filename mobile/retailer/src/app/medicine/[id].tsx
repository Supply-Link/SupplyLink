// Medicine detail screen — full product spec, batch list,
// and add-to-basket action.

import { useLocalSearchParams, useRouter } from '@/navigation/router';
import { Minus, Package, Plus, ShoppingBasket } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
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
  const quantity = cart.lines.get(product.id) ?? 0;

  const footer =
    product.stock > 0 ? (
      <View className="border-t border-line bg-white px-4 pb-6 pt-3">
        {quantity === 0 ? (
          <Button title="Add to basket" icon={Plus} onPress={() => cart.add(product)} />
        ) : (
          <View className="flex-row items-center">
            <View className="h-[52px] w-[140px] flex-row items-center justify-between rounded-2xl bg-brand px-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Decrease quantity"
                hitSlop={6}
                onPress={() => (quantity <= 1 ? cart.remove(product.id) : cart.setQuantity(product, quantity - 1))}
                className="h-11 w-11 items-center justify-center"
              >
                <Minus size={20} color="#fff" />
              </Pressable>
              <Text className="text-lg font-bold text-white" accessibilityLabel={`Quantity ${quantity}`}>
                {quantity}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Increase quantity"
                hitSlop={6}
                onPress={() => cart.add(product)}
                className="h-11 w-11 items-center justify-center"
              >
                <Plus size={20} color="#fff" />
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View basket"
              onPress={() => router.navigate('/basket')}
              className="ml-3 h-[52px] flex-1 flex-row items-center justify-center rounded-2xl border-[1.5px] border-brand bg-white active:bg-brand-soft"
            >
              <ShoppingBasket size={18} color={colors.brand} />
              <Text className="ml-2 text-base font-bold text-brand">View basket</Text>
            </Pressable>
          </View>
        )}
      </View>
    ) : undefined;

  return (
    <Screen title="Medicine details" subtitle={product.name} onBack={router.back} footer={footer} bottomInset={!footer}>
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
      {batches.length > 0 ? <Muted className="text-xs">Oldest expiry is supplied first.</Muted> : null}
      {batches.length === 0 ? <EmptyState message="No batch stock has been received yet." /> : null}
      {batches.map((b) => (
        <Card key={b.id}>
          <View className="flex-row items-center">
            <Package size={16} color={colors.brand} />
            <Text className="ml-2 flex-1 text-[17px] font-bold text-ink">Batch {b.batch_number}</Text>
            <Text className="text-xs font-semibold uppercase text-muted">{(b.status ?? 'available').replace('_', ' ')}</Text>
          </View>
          <Muted className="text-sm">
            Expiry {b.expiry_date} · Manufactured {b.manufacturing_date}
            {'\n'}MRP {money(b.mrp)} (incl. GST) · Stock {b.stock}
          </Muted>
        </Card>
      ))}
    </Screen>
  );
}
