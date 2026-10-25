import { useRouter } from '@/navigation/router';
import { Minus, Plus, ReceiptText, ShoppingBasket, Trash } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Card, colors, EmptyState, Field, Muted, Screen, Segmented, Select, Title } from '@/components/ui';
import { money } from '@/lib/rules';
import { STATE_OPTIONS } from '@/lib/states';
import type { Product, Quote } from '@/lib/types';
import { useCart } from '@/session/CartProvider';
import { useSession } from '@/session/SessionProvider';

const PAYMENT_OPTIONS = [
  { value: 'cod' as const, label: 'Cash on delivery' },
  { value: 'credit' as const, label: 'Trade credit' },
];

export default function BasketScreen() {
  const router = useRouter();
  const { workspace, user, request, busy } = useSession();
  const cart = useCart();
  const [address, setAddress] = useState(user?.address ?? '');
  const [stateCode, setStateCode] = useState(user?.state_code ?? '29');
  const [method, setMethod] = useState<'cod' | 'credit'>('cod');

  const products = new Map((workspace?.products ?? []).map((p) => [p.id, p]));

  const reviewQuote = async () => {
    const quote = await request<Quote>('POST', '/api/quote', { items: cart.items(), supply_state_code: stateCode });
    if (!quote) return;
    cart.setCheckout({ quote, address, stateCode, method });
    router.push('/review');
  };

  return (
    <Screen title="Basket" subtitle={user?.business ?? user?.name}>
      {cart.lines.size === 0 ? (
        <>
          <EmptyState message="Your basket is empty. Browse medicines to start an order." icon={ShoppingBasket} />
          <Button title="Browse medicines" onPress={() => router.navigate('/medicines')} />
        </>
      ) : (
        <>
          {[...cart.lines].map(([id, quantity]) => {
            const product = products.get(id);
            return product ? <BasketLine key={id} product={product} quantity={quantity} /> : null;
          })}

          <Card>
            <Title>Delivery & billing</Title>
            <Field label="Delivery address" value={address} onChangeText={setAddress} multiline />
            <Select
              label="Place of supply · GST state"
              value={stateCode}
              options={STATE_OPTIONS}
              onChange={setStateCode}
            />
            <Segmented label="Payment method" value={method} options={PAYMENT_OPTIONS} onChange={setMethod} />
            <Button title="Review server quote" icon={ReceiptText} disabled={busy} onPress={reviewQuote} />
            <Muted>
              Final batches are allocated by earliest expiry when the order is placed. Review the server quote before
              confirming.
            </Muted>
          </Card>
        </>
      )}
    </Screen>
  );
}

function BasketLine({ product, quantity }: { product: Product; quantity: number }) {
  const cart = useCart();
  return (
    <Card>
      <Text className="text-lg font-bold text-ink">{product.name}</Text>
      <Muted className="text-sm">
        {quantity} × {money(product.price)} excl. GST · {product.stock} in stock
      </Muted>
      <View className="mt-3 flex-row items-center">
        <Stepper icon={Minus} label="Decrease quantity" disabled={quantity <= 1} onPress={() => cart.setQuantity(product, quantity - 1)} />
        <Text className="w-12 text-center text-lg font-bold text-ink" accessibilityLabel={`Quantity ${quantity}`}>
          {quantity}
        </Text>
        <Stepper
          icon={Plus}
          label="Increase quantity"
          disabled={quantity >= product.stock}
          onPress={() => cart.setQuantity(product, quantity + 1)}
        />
        <View className="flex-1" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${product.name}`}
          onPress={() => cart.remove(product.id)}
          className="flex-row items-center rounded-xl px-3 py-2 active:bg-red-50"
        >
          <Trash size={16} color={colors.danger} />
          <Text className="ml-1.5 font-semibold text-danger">Remove</Text>
        </Pressable>
      </View>
    </Card>
  );
}

function Stepper({
  icon: Icon,
  label,
  disabled,
  onPress,
}: {
  icon: typeof Plus;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      className={`h-10 w-10 items-center justify-center rounded-xl border border-line bg-canvas ${disabled ? 'opacity-40' : 'active:opacity-70'}`}
    >
      <Icon size={18} color={colors.brand} />
    </Pressable>
  );
}
