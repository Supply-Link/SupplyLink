// Account tab — user profile, GSTIN, drug licence, licence status,
// payment history, and sign-out.

import { useRouter } from '@/navigation/router';
import { Banknote, Building, CircleHelp, CreditCard, FileText, LogOut, RefreshCw } from 'lucide-react-native';
import { Text } from 'react-native';
import { Body, Button, Card, EmptyState, Muted, Screen, SectionLabel, Title } from '@/components/ui';
import { APP } from '@/lib/config';
import { dateTime, money } from '@/lib/rules';
import { stateName } from '@/lib/states';
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
        <Body className="text-sm">
          GSTIN: {user?.gstin || '—'}
          {'\n'}Drug licence: {user?.drug_license || '—'}
          {'\n'}State: {stateName(user?.state_code)}
        </Body>
        <Button title="Edit business details" icon={Building} variant="secondary" onPress={() => router.push('/business')} />
        <Muted className="mt-3 text-xs">Server: {serverUrl}</Muted>
        <Muted className="text-xs">
          Software licence: {licence.status ?? '—'} · Expiry: {licence.expires_on ?? '—'}
        </Muted>
      </Card>

      <Button title="Credit & payments" icon={CreditCard} variant="secondary" onPress={() => router.push('/finance')} />
      <Button title="Order records & returns" icon={FileText} variant="secondary" onPress={() => router.push('/records')} />
      <Button title="Help & support" icon={CircleHelp} variant="secondary" onPress={() => router.push('/help')} />

      <SectionLabel>Payment history</SectionLabel>
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

      <Button title="Refresh account" icon={RefreshCw} variant="secondary" onPress={refresh} />
      <Button title="Sign out" icon={LogOut} variant="danger" onPress={signOut} />
    </Screen>
  );
}
