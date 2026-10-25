import { useLocalSearchParams, useRouter } from 'expo-router';
import { FileText } from 'lucide-react-native';
import { Text } from 'react-native';
import { Totals } from '@/components/orders';
import { Body, Card, EmptyState, Muted, Screen, SectionLabel, Title } from '@/components/ui';
import { dateTime, money, percent } from '@/lib/rules';
import { useSession } from '@/session/SessionProvider';

export default function StatementScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { workspace } = useSession();
  const order = workspace?.orders.find((entry) => entry.id === id);
  if (!order) return <Screen title="Transaction record" onBack={router.back} bottomInset><EmptyState message="This order is unavailable." icon={FileText} /></Screen>;
  return (
    <Screen title="Transaction record" subtitle={`${order.number} · ${dateTime(order.created_at)}`} onBack={router.back} bottomInset>
      <Card className="border-brand-soft bg-brand-soft">
        <Title className="text-base">Order statement</Title>
        <Muted>This is a saved transaction record for review. It is not a statutory GST invoice or credit note.</Muted>
      </Card>
      <SectionLabel>Parties</SectionLabel>
      <Card>
        <Title className="text-base">Supplier</Title>
        <Body>{order.supplier?.legal_name || order.supplier?.business || 'Supplier unavailable'}</Body>
        <Muted>{order.supplier?.address || 'Address unavailable'}</Muted>
        <Muted>GSTIN: {order.supplier?.gstin || 'Not provided'}</Muted>
      </Card>
      <Card>
        <Title className="text-base">Buyer</Title>
        <Body>{order.buyer?.legal_name || order.buyer?.business || order.retailer_name}</Body>
        <Muted>{order.buyer?.address || order.address}</Muted>
        <Muted>GSTIN: {order.buyer?.gstin || 'Not provided'}</Muted>
      </Card>
      <SectionLabel>Items and batches</SectionLabel>
      {order.lines.map((line) => (
        <Card key={line.product_id}>
          <Title className="text-base">{line.name}</Title>
          <Muted>{line.quantity} × {money(line.unit_price)} · {line.unit}</Muted>
          <Muted>HSN {line.hsn_code || '—'} · GST {percent(line.gst_rate_bps)} · Tax {money(line.tax)}</Muted>
          {line.batches?.map((batch) => <Text key={batch.batch_number} className="mt-2 text-sm text-ink">Batch {batch.batch_number} · Qty {batch.quantity} · Exp {batch.expiry_date}</Text>)}
        </Card>
      ))}
      <SectionLabel>Tax summary</SectionLabel>
      <Card><Totals totals={order} /><Muted>Place of supply: {order.supply_state_code || '—'} · {order.tax_type || 'Tax type unavailable'}</Muted></Card>
    </Screen>
  );
}
