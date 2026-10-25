import { useRouter } from 'expo-router';
import { Banknote, CircleHelp, LogOut, RefreshCw } from 'lucide-react-native';
import { Text } from 'react-native';
import { Button, Card, EmptyState, Muted, Screen, SectionLabel, Title } from '@/components/ui';
import { APP } from '@/lib/config';
import { dateTime, money } from '@/lib/rules';
import { useSession } from '@/session/SessionProvider';

export default function AccountScreen() {
  const router = useRouter();
  const { user, workspace, licence, serverUrl, refresh, signOut } = useSession();
  const payments = workspace?.payments ?? [];

  return (
    <Screen title="Account" subtitle={user?.business ?? user?.name} onRefresh={refresh}>
      <Card>
        <Title className="text-[23px]">{user?.name}</Title>
        <Muted className="text-[15px]">
          {user?.email}
          {'\n'}
          {user?.business}
          {'\n'}Role: {APP.roleLabel}
        </Muted>
        <Muted className="mt-3 text-xs">Server: {serverUrl}</Muted>
        <Muted className="text-xs">
          Software licence: {licence.status ?? '—'} · Expiry: {licence.expires_on ?? '—'}
        </Muted>
      </Card>

      <SectionLabel>Collections</SectionLabel>
      {payments.length === 0 ? <EmptyState message="No payments recorded." icon={Banknote} /> : null}
      {payments.map((p) => (
        <Card key={p.id}>
          <Text className="text-base font-bold text-ink">
            {p.order_number} · {money(p.amount)}
          </Text>
          <Muted>Reference: {p.reference}</Muted>
          <Muted className="text-xs">{dateTime(p.at)}</Muted>
        </Card>
      ))}

      <Button title="Help & support" icon={CircleHelp} variant="secondary" onPress={() => router.push('/help')} />
      <Button title="Refresh account" icon={RefreshCw} variant="secondary" onPress={refresh} />
      <Button title="Sign out" icon={LogOut} variant="danger" onPress={signOut} />
    </Screen>
  );
}
