import { useRouter } from 'expo-router';
import { Bell, CheckCheck } from 'lucide-react-native';
import { NotificationList } from '@/components/notifications';
import { Button, Screen } from '@/components/ui';
import { useSession } from '@/session/SessionProvider';

export default function AlertsScreen() {
  const router = useRouter();
  const { workspace, request, refresh } = useSession();

  const markAllRead = async () => {
    if (await request('POST', '/api/notifications/read', {})) await refresh();
  };

  return (
    <Screen title="Notifications" onBack={router.back} onRefresh={refresh} bottomInset>
      <Button title="Mark all read" icon={CheckCheck} variant="secondary" onPress={markAllRead} />
      <NotificationList notifications={workspace?.notifications ?? []} emptyIcon={Bell} />
    </Screen>
  );
}
