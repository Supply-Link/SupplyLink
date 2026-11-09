// Account tab — profile header, tax details and a tidy list of destinations,
// with a confirmed sign-out.

import { useRouter } from '@/navigation/router';
import { Bell, Building, CircleHelp, CreditCard, FileText, LogOut } from 'lucide-react-native';
import { Alert, Text, View } from 'react-native';
import { Card, MenuRow, Screen } from '@/components/ui';
import { APP } from '@/lib/config';
import { stateName } from '@/lib/states';
import { useSession } from '@/session/SessionProvider';

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-1.5">
      <Text className="text-sm text-muted">{label}</Text>
      <Text className="ml-4 flex-1 text-right text-sm font-medium text-ink" numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export default function AccountScreen() {
  const router = useRouter();
  const { user, workspace, refresh, signOut } = useSession();
  const unread = workspace?.notifications.filter((n) => !n.read).length ?? 0;
  const initial = (user?.name ?? '?').trim().charAt(0).toUpperCase();

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'You will need to sign in again to place orders.', [
      { text: 'Stay signed in', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);

  return (
    <Screen title="Account" subtitle={user?.business ?? user?.name} onRefresh={refresh}>
      <Card>
        <View className="flex-row items-center">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-brand">
            <Text className="text-2xl font-bold text-white">{initial}</Text>
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-xl font-bold text-ink" numberOfLines={1}>
              {user?.name}
            </Text>
            <Text className="mt-1 text-[13px] text-muted" numberOfLines={1}>
              {user?.email}
            </Text>
            <Text className="text-[13px] text-muted" numberOfLines={1}>
              {APP.roleLabel} · {user?.business}
            </Text>
          </View>
        </View>
        <View className="mt-3 border-t border-line pt-2">
          <Detail label="GSTIN" value={user?.gstin || 'Not added'} />
          <Detail label="Drug licence" value={user?.drug_license || 'Not added'} />
          <Detail label="GST state" value={stateName(user?.state_code)} />
          <Detail label="Address" value={user?.address || 'Not added'} />
        </View>
      </Card>

      <Card className="py-1">
        <MenuRow icon={Building} label="Business details" hint="GSTIN, drug licence and address" onPress={() => router.push('/business')} />
        <MenuRow icon={CreditCard} label="Credit & payments" hint="Trade credit and recorded payments" onPress={() => router.push('/finance')} />
        <MenuRow icon={FileText} label="Order records & returns" hint="Saved order facts and return requests" onPress={() => router.push('/records')} />
        <MenuRow icon={Bell} label="Notifications" hint={unread > 0 ? `${unread} new` : 'You are all caught up'} onPress={() => router.push('/alerts')} />
        <MenuRow icon={CircleHelp} label="Help & support" onPress={() => router.push('/help')} />
        <MenuRow icon={LogOut} label="Sign out" danger onPress={confirmSignOut} />
      </Card>
    </Screen>
  );
}
