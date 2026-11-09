// Account tab — profile, collections and help, with a confirmed sign-out.

import { useRouter } from '@/navigation/router';
import { Banknote, CircleHelp, LogOut } from 'lucide-react-native';
import { Alert, Text, View } from 'react-native';
import { Card, EmptyState, MenuRow, Muted, Screen, SectionLabel } from '@/components/ui';
import { APP } from '@/lib/config';
import { dateTime, money } from '@/lib/rules';
import { useSession } from '@/session/SessionProvider';

export default function AccountScreen() {
  const router = useRouter();
  const { user, workspace, refresh, signOut } = useSession();
  const payments = [...(workspace?.payments ?? [])].reverse();
  const initial = (user?.name ?? '?').trim().charAt(0).toUpperCase();

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'You will need to sign in again to see your deliveries.', [
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
              {APP.roleLabel}
              {user?.business ? ` · ${user.business}` : ''}
            </Text>
          </View>
        </View>
      </Card>

      <Card className="py-1">
        <MenuRow icon={CircleHelp} label="Help & support" onPress={() => router.push('/help')} />
        <MenuRow icon={LogOut} label="Sign out" danger onPress={confirmSignOut} />
      </Card>

      <SectionLabel>Collections</SectionLabel>
      {payments.length === 0 ? (
        <EmptyState message="Cash you collect on delivery will be listed here." icon={Banknote} />
      ) : null}
      {payments.map((p) => (
        <Card key={p.id}>
          <Text className="text-base font-bold text-ink">
            {p.order_number} · {money(p.amount)}
          </Text>
          <Muted>Receipt: {p.reference}</Muted>
          <Muted className="text-xs">{dateTime(p.at)}</Muted>
        </Card>
      ))}
    </Screen>
  );
}
