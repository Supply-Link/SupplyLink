// Sign-in screen — email and password form; server URL comes from .env.

import { useRouter } from '@/navigation/router';
import { LogIn, UserPlus } from 'lucide-react-native';
import { useState } from 'react';
import { Alert } from 'react-native';
import { Button, Card, Field, Muted, Screen, Title } from '@/components/ui';
import { APP, DEFAULT_SERVER } from '@/lib/config';
import { useSession } from '@/session/SessionProvider';

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, setServer, busy } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = () => {
    if (!email.trim()) return Alert.alert('Required', 'Enter your email address.');
    if (!password) return Alert.alert('Required', 'Enter your password.');
    signIn(DEFAULT_SERVER, email.trim(), password);
  };

  return (
    <Screen title="Welcome back" subtitle={APP.tagline} bottomInset>
      <Card>
        <Title>Sign in to your workspace</Title>
        <Muted className="text-sm">Use the account approved by your administrator.</Muted>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="username"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          onSubmitEditing={submit}
        />
        <Button title="Sign in" icon={LogIn} disabled={busy} onPress={submit} />
        {__DEV__ ? (
          <Button
            title="Dev: Quick sign in"
            variant="secondary"
            disabled={busy}
            onPress={() => signIn(DEFAULT_SERVER, 'retailer@supplylink.local', 'Demo@123')}
          />
        ) : null}
        <Button
          title="Request an account"
          icon={UserPlus}
          variant="secondary"
          onPress={async () => {
            if (await setServer(DEFAULT_SERVER)) router.push('/register');
          }}
        />
      </Card>
      <Muted className="mt-3 text-xs">
        Your session stays in memory. Passwords are never saved on this device.
      </Muted>
    </Screen>
  );
}
