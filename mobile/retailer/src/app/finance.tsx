// Finance screen — credit meter, unpaid credit-order list,
// and recorded payment history.

import { useRouter } from '@/navigation/router';
import { Banknote, CreditCard, RefreshCw, ReceiptText } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { OrderCard } from '@/components/orders';
import { Button, Card, colors, EmptyState, Muted, Row, Screen, SectionLabel, Title } from '@/components/ui';
import { dateTime, money } from '@/lib/rules';
import { useSession } from '@/session/SessionProvider';

export default function FinanceScreen() {
  const router = useRouter();
  const { user, workspace, refresh } = useSession();
  const limit = user?.credit_limit ?? 0;
  const used = user?.credit_used ?? 0;
  const available = Math.max(0, limit - used);
  const ratio = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const creditOrders = (workspace?.orders ?? []).filter(
    (order) => order.payment_method === 'credit' && order.payment_status !== 'paid' && order.status !== 'cancelled',
  );
  const payments = [...(workspace?.payments ?? [])].reverse();

  return (
    <Screen title="Credit & payments" subtitle="Your purchasing capacity and recorded receipts" onBack={router.back} onRefresh={refresh} bottomInset>
      <Card>
        <View className="flex-row items-center">
          <CreditCard size={22} color={colors.brand} />
          <Text className="ml-2 text-xs font-bold uppercase tracking-widest text-muted">Available trade credit</Text>
        </View>
        <Text className="mt-3 text-[30px] font-semibold tracking-tight text-brand">{money(available)}</Text>
        <Muted>Trade credit is reserved when an order is placed and released after payment or cancellation.</Muted>
        <View className="mt-4 h-2 overflow-hidden rounded-full bg-brand-soft">
          <View className="h-full rounded-full bg-brand" style={{ width: `${ratio}%` }} />
        </View>
        <View className="mt-3 border-t border-line pt-2">
          <Row label="Approved limit" value={money(limit)} />
          <Row label="Outstanding credit" value={money(used)} />
        </View>
      </Card>

      <SectionLabel>Orders using trade credit</SectionLabel>
      {creditOrders.length === 0 ? <EmptyState message="No unpaid trade-credit orders." icon={ReceiptText} /> : null}
      {creditOrders.map((order) => <OrderCard key={order.id} order={order} />)}

      <SectionLabel>Recorded payments</SectionLabel>
      <Card>
        <Muted>Payments shown here were recorded outside SupplyLink. This app does not charge or transfer money.</Muted>
      </Card>
      {payments.length === 0 ? <EmptyState message="No payments have been recorded." icon={Banknote} /> : null}
      {payments.map((payment) => (
        <Card key={payment.id}>
          <Title className="text-base">{payment.order_number} · {money(payment.amount)}</Title>
          <Muted>Reference: {payment.reference}</Muted>
          <Muted>{dateTime(payment.at)}</Muted>
        </Card>
      ))}
      <Button title="Refresh balances" icon={RefreshCw} variant="secondary" onPress={refresh} />
    </Screen>
  );
}
