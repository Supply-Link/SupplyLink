// Register screen — new-account form for delivery partners;
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
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const set = (key: keyof typeof form) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = () => {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = 'Enter your full name.';
    if (!form.business.trim()) next.business = `Enter your ${APP.businessLabel.toLowerCase()}.`;
    if (!form.email.trim()) next.email = 'Enter your email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter a valid email, like name@company.com.';
    if (form.password.length < 10) next.password = 'Use at least 10 characters.';
    if (!form.address.trim()) next.address = 'Enter your address.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    const result = await request('POST', '/api/register', { ...form, role: ROLE });
    if (!result) return;
    router.back();
    Alert.alert('Registration submitted', 'Your administrator must approve your account before sign-in.');
  };

  return (
    <Screen title="Join SupplyLink" subtitle="Administrator approval is required" onBack={router.back} bottomInset>
      <Card>
        <Field label="Full name" value={form.name} onChangeText={set('name')} error={errors.name} placeholder="As on your ID" autoComplete="name" />
        <Field label={APP.businessLabel} value={form.business} onChangeText={set('business')} error={errors.business} placeholder="Company or team name" />
        <Field
          label="Email"
          value={form.email}
          onChangeText={set('email')}
          error={errors.email}
          placeholder="name@company.com"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <Field
          label="Password (10+ characters)"
          value={form.password}
          onChangeText={set('password')}
          error={errors.password}
          placeholder="At least 10 characters"
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <Field label="Address" value={form.address} onChangeText={set('address')} error={errors.address} placeholder="Street, area, city, PIN" multiline />
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
