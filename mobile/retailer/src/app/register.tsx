// Register screen — new-account form for pharmacy retailers;
// admin approval required before sign-in.

import { useRouter } from '@/navigation/router';
import { Send } from 'lucide-react-native';
import { useState } from 'react';
import { Alert } from 'react-native';
import { Button, Card, Field, Muted, Screen, Select } from '@/components/ui';
import { APP, ROLE } from '@/lib/config';
import { STATE_OPTIONS } from '@/lib/states';
import { useSession } from '@/session/SessionProvider';

export default function RegisterScreen() {
  const router = useRouter();
  const { request, busy } = useSession();
  const [form, setForm] = useState({
    name: '',
    business: '',
    email: '',
    password: '',
    address: '',
    state_code: '29',
    gstin: '',
    drug_license: '',
  });
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    const result = await request('POST', '/api/register', { ...form, role: ROLE });
    if (!result) return;
    router.back();
    Alert.alert('Registration submitted', 'Your administrator must approve your account before sign-in.');
  };

  return (
    <Screen title="Join SupplyLink" subtitle="Administrator approval is required" onBack={router.back} bottomInset>
      <Card>
        <Field label="Full name" value={form.name} onChangeText={set('name')} autoComplete="name" />
        <Field label={APP.businessLabel} value={form.business} onChangeText={set('business')} />
        <Field
          label="Email"
          value={form.email}
          onChangeText={set('email')}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <Field
          label="Password (10+ characters)"
          value={form.password}
          onChangeText={set('password')}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <Field label="Address" value={form.address} onChangeText={set('address')} multiline />
        <Select label="GST state" value={form.state_code} options={STATE_OPTIONS} onChange={set('state_code')} />
        <Field label="GSTIN (optional)" value={form.gstin} onChangeText={set('gstin')} autoCapitalize="characters" />
        <Field label="Drug licence (optional)" value={form.drug_license} onChangeText={set('drug_license')} />
        <Button title="Submit registration" icon={Send} disabled={busy} onPress={submit} />
      </Card>
      <Muted className="mt-3 text-xs">
        GSTIN must begin with your state code. Government registry checks are not performed.
      </Muted>
      <Button title="Back to sign in" variant="secondary" onPress={router.back} />
    </Screen>
  );
}
