import { useRouter } from 'expo-router';
import { CircleCheck } from 'lucide-react-native';
import { Text } from 'react-native';
import { Totals } from '@/components/orders';
import { Body, Button, Card, EmptyState, Muted, Screen, Title } from '@/components/ui';
import { money } from '@/lib/rules';
import { stateName } from '@/lib/states';
import type { Order } from '@/lib/types';
import { CHECKOUT_SCOPE, useCart } from '@/session/CartProvider';
import { useSession } from '@/session/SessionProvider';
import { useToast } from '@/session/ToastProvider';

export default function ReviewScreen() {
  const router = useRouter();
  const toast = useToast();
  const { request, refresh, keyFor, busy } = useSession();
  const cart = useCart();
  const checkout = cart.checkout;

  if (!checkout) {
    return (
      <Screen title="Review your order" onBack={router.back} bottomInset>
        <EmptyState message="Your basket changed. Review a new server quote." />
        <Button title="Back to basket" variant="secondary" onPress={router.back} />
      </Screen>
    );
  }

  const { quote, address, stateCode, method } = checkout;

  const placeOrder = async () => {
    const order = await request<Order>(
      'POST',
      '/api/orders',
      {
        items: cart.items(),
        address,
        supply_state_code: stateCode,
        payment_method: method,
        expected_total: quote.total,
      },
      { idempotencyKey: keyFor(CHECKOUT_SCOPE) },
    );
    if (!order) return;
    router.dismissAll();
    router.navigate('/orders');
    cart.clear();
    toast(`Order ${order.number} placed successfully.`);
    await refresh();
  };

  return (
    <Screen title="Review your order" subtitle="Server-calculated prices and GST" onBack={router.back} bottomInset>
      <Card>
        {quote.lines.map((line) => (
          <Text key={line.product_id} className="py-0.5 text-sm text-ink">
            {line.quantity} × {line.name}
          </Text>
        ))}
      </Card>
      <Card>
        <Totals totals={quote} />
      </Card>
      <Card>
        <Title className="text-base">Delivery</Title>
        <Body className="text-sm">{address}</Body>
        <Muted>
          Place of supply: {stateName(stateCode)} · {quote.tax_type}
          {'\n'}Payment: {method === 'cod' ? 'Cash on delivery' : 'Trade credit'}
        </Muted>
      </Card>
      <Button title={`Place order · ${money(quote.total)}`} icon={CircleCheck} disabled={busy} onPress={placeOrder} />
      <Button title="Back to basket" variant="secondary" onPress={router.back} />
    </Screen>
  );
}
