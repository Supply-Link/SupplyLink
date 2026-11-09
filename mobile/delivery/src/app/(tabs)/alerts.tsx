// Alerts tab — notification list with mark-all-read;
// unread count shown as a tab-bar badge.

import { Bell, CheckCheck } from 'lucide-react-native';
import { NotificationList } from '@/components/notifications';
import { Button, Screen } from '@/components/ui';
import { useSession } from '@/session/SessionProvider';

export default function AlertsScreen() {
  const { workspace, user, request, refresh } = useSession();

  const markAllRead = async () => {
    if (await request('POST', '/api/notifications/read', {})) await refresh();
  };

  return (
    <Screen title="Alerts" subtitle={user?.business ?? user?.name} onRefresh={refresh} loading={!workspace}>
      {workspace?.notifications.some((n) => !n.read) ? (
        <Button title="Mark all read" icon={CheckCheck} variant="secondary" onPress={markAllRead} />
      ) : null}
      <NotificationList notifications={workspace?.notifications ?? []} emptyIcon={Bell} />
    </Screen>
  );
}
