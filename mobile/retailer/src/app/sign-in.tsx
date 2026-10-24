import { useRouter } from 'expo-router';
import { LogIn, UserPlus } from 'lucide-react-native';
import { useState } from 'react';
import { Button, Card, Field, Muted, Screen, Title } from '@/components/ui';
import { APP } from '@/lib/config';
import { useSession } from '@/session/SessionProvider';

export default function SignInScreen() {
  const router = useRouter();
  const { serverUrl, signIn, setServer, busy } = useSession();
  const [server, setServerInput] = useState(serverUrl);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <Screen title="Welcome back" subtitle={APP.tagline} bottomInset>
      <Card>
        <Title>Sign in to your workspace</Title>
        <Muted className="text-sm">Use the account approved by your administrator.</Muted>
        <Field
          label="Server URL"
          value={server}
          onChangeText={setServerInput}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="https://supplylink.example.com"
        />
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
          onSubmitEditing={() => signIn(server, email, password)}
        />
        <Button title="Sign in" icon={LogIn} disabled={busy} onPress={() => signIn(server, email, password)} />
        <Button
          title="Request an account"
          icon={UserPlus}
          variant="secondary"
          onPress={async () => {
            if (await setServer(server)) router.push('/register');
          }}
        />
      </Card>
      <Muted className="mt-3 text-xs">
        Your session stays in memory. Passwords are never saved on this device.
      </Muted>
    </Screen>
  );
}
