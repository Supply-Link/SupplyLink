// Sign-in screen — email and password form; server URL comes from .env.

import { useRouter } from '@/navigation/router';
import { LogIn, UserPlus } from 'lucide-react-native';
import { useState } from 'react';
import { Button, Card, Field, Muted, Screen, Title } from '@/components/ui';
import { APP, DEFAULT_SERVER } from '@/lib/config';
import { useSession } from '@/session/SessionProvider';

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, setServer, busy } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const submit = () => {
    const next: typeof errors = {};
    if (!email.trim()) next.email = 'Enter your email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Enter a valid email, like name@company.com.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    if (Object.keys(next).length === 0) void signIn(DEFAULT_SERVER, email.trim(), password);
  };

  return (
    <Screen title="Welcome back" subtitle={APP.tagline} bottomInset>
      <Card>
        <Title>Sign in to your workspace</Title>
        <Muted className="text-sm">Use the account approved by your administrator.</Muted>
        <Field
          label="Email"
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setErrors((e) => ({ ...e, email: undefined }));
          }}
          error={errors.email}
          placeholder="name@company.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="username"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setErrors((e) => ({ ...e, password: undefined }));
          }}
          error={errors.password}
          placeholder="Your password"
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
            onPress={() => signIn(DEFAULT_SERVER, 'delivery@supplylink.local', 'Demo@123')}
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
