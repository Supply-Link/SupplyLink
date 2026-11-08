// Order-specific shared components: StageIcon, StageBadge, OrderCard list item,
// Totals breakdown row group, and Timeline history list.

import { useRouter } from '@/navigation/router';
import {
  ChevronRight,
  CircleCheck,
  CircleX,
  ClipboardList,
  Package,
  PackageCheck,
  Truck,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { dateTime, money, stageLabel } from '@/lib/rules';
import type { Order, OrderStatus, TaxTotals } from '@/lib/types';
import { colors, Row } from './ui';

const STAGE_ICONS: Record<OrderStatus, LucideIcon> = {
  placed: ClipboardList,
  confirmed: CircleCheck,
  packed: Package,
  out_for_delivery: Truck,
  delivered: PackageCheck,
  cancelled: CircleX,
};

export function StageIcon({ status, size = 14 }: { status: string; size?: number }) {
  const Icon = STAGE_ICONS[status as OrderStatus] ?? ClipboardList;
  return <Icon size={size} color={status === 'cancelled' ? colors.danger : colors.brand} />;
}

export function StageBadge({ status }: { status: string }) {
  const cancelled = status === 'cancelled';
  return (
    <View className={`mt-1.5 flex-row items-center self-start rounded-full px-2.5 py-1 ${cancelled ? 'bg-red-50' : 'bg-brand-accent/60'}`}>
      <StageIcon status={status} />
      <Text className={`ml-1.5 text-[13px] font-semibold ${cancelled ? 'text-danger' : 'text-brand'}`}>{stageLabel(status)}</Text>
    </View>
  );
}

export function OrderCard({ order }: { order: Order }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Order ${order.number}, ${stageLabel(order.status)}, ${money(order.total)}`}
      onPress={() => router.push({ pathname: '/order/[id]', params: { id: order.id } })}
      className="mt-2.5 flex-row items-center rounded-card border border-line bg-white px-4 py-3.5 active:opacity-80"
    >
      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-bold text-ink">{order.number}</Text>
          <Text className="text-lg font-bold text-ink">{money(order.total)}</Text>
        </View>
        <StageBadge status={order.status} />
        <Text className="mt-1.5 text-[13px] text-muted">{order.retailer_name}</Text>
        <Text className="text-[13px] text-muted">{dateTime(order.created_at)}</Text>
      </View>
      <ChevronRight size={18} color={colors.muted} style={{ marginLeft: 8 }} />
    </Pressable>
  );
}

const TOTAL_FIELDS: [keyof TaxTotals, string][] = [
  ['subtotal', 'Subtotal'],
  ['discount', 'Discount'],
  ['taxable', 'Taxable value'],
  ['cgst', 'CGST'],
  ['sgst', 'SGST'],
  ['utgst', 'UTGST'],
  ['igst', 'IGST'],
  ['tax', 'Total GST'],
];

export function Totals({ totals }: { totals: TaxTotals }) {
  return (
    <View>
      {TOTAL_FIELDS.filter(([field]) => (totals[field] ?? 0) !== 0).map(([field, label]) => (
        <Row key={field} label={label} value={money(totals[field])} />
      ))}
      <Row label="Total" value={money(totals.total)} strong />
    </View>
  );
}

export function Timeline({ history }: { history: Order['history'] }) {
  return (
    <View className="mt-2">
      {history.map((entry, index) => (
        <View key={`${entry.status}-${entry.at}`} className="flex-row">
          <View className="items-center">
            <View className="h-8 w-8 items-center justify-center rounded-full bg-canvas">
              <StageIcon status={entry.status} size={16} />
            </View>
            {index < history.length - 1 ? <View className="w-0.5 flex-1 bg-[#b9caba]" /> : null}
          </View>
          <View className="ml-3 flex-1 pb-4">
            <Text className="text-base font-bold text-brand">{stageLabel(entry.status)}</Text>
            <Text className="text-[13px] text-muted">
              {dateTime(entry.at)} · {entry.by}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
