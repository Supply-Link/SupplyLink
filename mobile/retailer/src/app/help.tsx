import { useRouter } from '@/navigation/router';
import { CircleHelp, ClipboardList, Pill, RefreshCw } from 'lucide-react-native';
import { Button, Card, Muted, Screen, SectionLabel, Title } from '@/components/ui';
import { useSession } from '@/session/SessionProvider';

export default function HelpScreen() {
  const router = useRouter();
  const { serverUrl, refresh } = useSession();
  return (
    <Screen title="Help & support" subtitle="Quick answers for your pharmacy workspace" onBack={router.back} bottomInset>
      <Card>
        <Title className="text-base">Account and access</Title>
        <Muted>New accounts must be approved by an administrator. If you can sign in but see a licence screen, ask the server owner to activate or renew the SupplyLink licence.</Muted>
      </Card>
      <Card>
        <Title className="text-base">Medicines and orders</Title>
        <Muted>Browse the catalog for current stock and batch details. Your basket is kept on this device only while the app is open. The final price and GST are calculated by the server before you place an order.</Muted>
        <Button title="Browse medicines" icon={Pill} variant="secondary" onPress={() => router.navigate('/medicines')} />
        <Button title="View orders" icon={ClipboardList} variant="secondary" onPress={() => router.navigate('/orders')} />
      </Card>
      <Card>
        <Title className="text-base">Connection problems</Title>
        <Muted>Check that your phone can reach the server shown below. A production server needs a trusted HTTPS address.</Muted>
        <Muted>Server: {serverUrl}</Muted>
        <Button title="Try refreshing" icon={RefreshCw} variant="secondary" onPress={refresh} />
      </Card>
      <SectionLabel>Need a person?</SectionLabel>
      <Card>
        <Title className="text-base">Contact your distributor or administrator</Title>
        <Muted>Share your order number and a description of the problem. In-app support tickets are not available yet.</Muted>
        <Button title="Find an order number" icon={CircleHelp} variant="secondary" onPress={() => router.navigate('/orders')} />
      </Card>
    </Screen>
  );
}
