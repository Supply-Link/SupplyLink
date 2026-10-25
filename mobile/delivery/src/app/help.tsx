import { useRouter } from '@/navigation/router';
import { CircleHelp, RefreshCw, Truck } from 'lucide-react-native';
import { Button, Card, Muted, Screen, SectionLabel, Title } from '@/components/ui';
import { useSession } from '@/session/SessionProvider';

export default function HelpScreen() {
  const router = useRouter();
  const { serverUrl, refresh } = useSession();
  return (
    <Screen title="Help & support" subtitle="Quick answers for your delivery workspace" onBack={router.back} bottomInset>
      <Card>
        <Title className="text-base">Account and access</Title>
        <Muted>Your account needs administrator approval. If a licence screen appears after sign-in, ask the server owner to activate or renew the SupplyLink licence.</Muted>
      </Card>
      <Card>
        <Title className="text-base">Deliveries and location</Title>
        <Muted>Open an assigned order to see its address, items and timeline. You can share one location point only after confirming it. SupplyLink does not track your location in the background.</Muted>
        <Button title="View deliveries" icon={Truck} variant="secondary" onPress={() => router.navigate('/deliveries')} />
      </Card>
      <Card>
        <Title className="text-base">Connection problems</Title>
        <Muted>Check that your phone can reach the server shown below. A production server needs a trusted HTTPS address.</Muted>
        <Muted>Server: {serverUrl}</Muted>
        <Button title="Try refreshing" icon={RefreshCw} variant="secondary" onPress={refresh} />
      </Card>
      <SectionLabel>Need a person?</SectionLabel>
      <Card>
        <Title className="text-base">Contact your dispatcher or administrator</Title>
        <Muted>Share the delivery order number and what happened. In-app support tickets are not available yet.</Muted>
        <Button title="Find an order number" icon={CircleHelp} variant="secondary" onPress={() => router.navigate('/deliveries')} />
      </Card>
    </Screen>
  );
}
