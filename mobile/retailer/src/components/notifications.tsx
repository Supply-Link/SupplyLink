// NotificationList component — renders unread/read notification cards
// in reverse chronological order with an unread dot indicator.

import type { LucideIcon } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { dateTime } from '@/lib/rules';
import type { Notification } from '@/lib/types';
import { Card, EmptyState, Muted } from './ui';

export function NotificationList({ notifications, emptyIcon }: { notifications: Notification[]; emptyIcon?: LucideIcon }) {
  if (notifications.length === 0) return <EmptyState message="You are all caught up." icon={emptyIcon} />;
  return (
    <>
      {[...notifications].reverse().map((n) => (
        <Card key={n.id}>
          <View className="flex-row items-center">
            {n.read ? null : <View accessibilityLabel="Unread" className="mr-2 h-2.5 w-2.5 rounded-full bg-brand" />}
            <Text className="flex-1 text-[17px] font-bold text-ink">{n.title}</Text>
          </View>
          <Muted className="text-[15px]">{n.body}</Muted>
          <Muted className="text-xs">{dateTime(n.at)}</Muted>
        </Card>
      ))}
    </>
  );
}
