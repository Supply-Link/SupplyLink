import { useRouter } from '@/navigation/router';
import { Save } from 'lucide-react-native';
import { useState } from 'react';
import { Button, Card, Field, Muted, Screen, Select } from '@/components/ui';
import { STATE_OPTIONS } from '@/lib/states';
import { useSession } from '@/session/SessionProvider';
import { useToast } from '@/session/ToastProvider';

export default function BusinessScreen() {
  const router = useRouter();
  const toast = useToast();
  const { user, request, refresh, busy } = useSession();
  const [form, setForm] = useState({
    legal_name: user?.legal_name || user?.business || '',
    address: user?.address ?? '',
    state_code: user?.state_code ?? '29',
    gstin: user?.gstin ?? '',
    drug_license: user?.drug_license ?? '',
  });
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!(await request('POST', '/api/business', { user_id: user?.id, ...form }))) return;
    toast('Business details saved.');
    router.back();
    await refresh();
  };

  return (
    <Screen title="Business details" subtitle="Used for GST order records" onBack={router.back} bottomInset>
      <Card>
        <Field label="Legal business name" value={form.legal_name} onChangeText={set('legal_name')} />
        <Field label="Business address" value={form.address} onChangeText={set('address')} multiline />
        <Select label="GST state" value={form.state_code} options={STATE_OPTIONS} onChange={set('state_code')} />
        <Field label="GSTIN" value={form.gstin} onChangeText={set('gstin')} autoCapitalize="characters" />
        <Field label="Drug licence" value={form.drug_license} onChangeText={set('drug_license')} />
        <Button title="Save details" icon={Save} disabled={busy} onPress={save} />
      </Card>
      <Muted className="mt-3 text-xs">
        Changes apply to future orders. Existing order records keep the details captured when they were placed.
      </Muted>
    </Screen>
  );
}
