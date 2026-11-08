// Locked screen — shown when the licence is inactive;
// offers check-activation and sign-out.

import { LogOut, RefreshCw, ShieldAlert } from 'lucide-react-native';
import { View } from 'react-native';
import { Body, Button, Card, colors, Muted, Screen, Title } from '@/components/ui';
import { useSession } from '@/session/SessionProvider';

export default function LockedScreen() {
  const { user, licence, licenceExpired, checkLicence, signOut, busy } = useSession();

  return (
    <Screen title="Licence required" subtitle={`Signed in as ${user?.name ?? ''}`} bottomInset>
      <Card>
        <View className="flex-row items-center">
          <ShieldAlert size={24} color={colors.brand} />
          <Title className="ml-2 text-[22px]">Workspace unavailable</Title>
        </View>
        <Body className="mt-3 text-base">
          {licenceExpired
            ? 'The software licence has expired.'
            : 'This installation has no active software licence.'}
        </Body>
        <Muted className="text-[15px]">
          Only sign-in and sign-out are available. Contact your administrator to activate the installation.
        </Muted>
        {licence.expires_on ? <Muted>Valid through {licence.expires_on} (India time)</Muted> : null}
        <Button title="Check activation" icon={RefreshCw} disabled={busy} onPress={checkLicence} />
        <Button title="Sign out" icon={LogOut} variant="secondary" onPress={signOut} />
      </Card>
    </Screen>
  );
}
