import { useLocalSearchParams, useRouter } from 'expo-router';
import { Eraser, PenLine } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { Button, Card, EmptyState, Field, Muted, Screen, Title } from '@/components/ui';
import { useSession } from '@/session/SessionProvider';

const SIZE = 1000;
type Stroke = number[][];

export default function ProofScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { workspace, request, refresh, keyFor, dropKey, showError, busy } = useSession();
  const order = workspace?.orders.find((entry) => entry.id === id);
  const [recipientName, setRecipientName] = useState('');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [width, setWidth] = useState(1);
  const [height, setHeight] = useState(220);

  const point = (event: GestureResponderEvent): number[] => [
    Math.max(0, Math.min(SIZE, Math.round(event.nativeEvent.locationX * SIZE / width))),
    Math.max(0, Math.min(SIZE, Math.round(event.nativeEvent.locationY * SIZE / height))),
  ];
  const start = (event: GestureResponderEvent) => {
    const p = point(event);
    setStrokes((current) => current.length < 20 ? [...current, [p]] : current);
  };
  const move = (event: GestureResponderEvent) => {
    const p = point(event);
    setStrokes((current) => {
      if (current.length === 0) return current;
      const last = current[current.length - 1];
      if (last.length >= 200 || (last[last.length - 1][0] === p[0] && last[last.length - 1][1] === p[1])) return current;
      return [...current.slice(0, -1), [...last, p]];
    });
  };

  if (!order) return (
    <Screen title="Delivery confirmation" onBack={router.back} bottomInset>
      <EmptyState message="This delivery is unavailable. Refresh your assigned orders." />
    </Screen>
  );
  if (order.status !== 'out_for_delivery') return (
    <Screen title="Delivery confirmation" onBack={router.back} bottomInset>
      <EmptyState message="This order is not awaiting delivery confirmation." />
    </Screen>
  );

  const save = () => {
    const signature = strokes.filter((stroke) => stroke.length >= 2);
    if (!recipientName.trim()) return showError('Enter the recipient name.');
    if (signature.flat().length < 4) return showError('Ask the recipient to sign in the box.');
    Alert.alert('Confirm handoff', `Record ${recipientName.trim()} as the recipient and mark ${order.number} delivered?`, [
      { text: 'Back', style: 'cancel' },
      { text: 'Confirm delivery', onPress: async () => {
        const scope = `proof:${order.id}`;
        const result = await request('POST', '/api/proof-of-delivery', {
          order_id: order.id, recipient_name: recipientName.trim(), signature,
        }, { idempotencyKey: keyFor(scope) });
        if (!result) return;
        dropKey(scope);
        await refresh();
        router.back();
      } },
    ]);
  };

  return (
    <Screen title="Delivery confirmation" subtitle={order.number} onBack={router.back} bottomInset>
      <Card>
        <Title className="text-base">Recipient handoff</Title>
        <Muted>Ask the person receiving the package to sign. The signature and recipient name are saved with this order when you confirm delivery.</Muted>
        <Field label="Recipient full name" value={recipientName} onChangeText={setRecipientName} autoComplete="name" />
      </Card>
      <Card>
        <View className="flex-row items-center">
          <PenLine size={18} color="#173d34" />
          <Text className="ml-2 text-base font-bold text-ink">Signature</Text>
        </View>
        <Muted>Sign inside the box with a finger or stylus.</Muted>
        <View
          className="mt-3 h-[220px] overflow-hidden rounded-xl border border-line bg-canvas"
          onLayout={(event) => { setWidth(event.nativeEvent.layout.width); setHeight(event.nativeEvent.layout.height); }}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={start}
          onResponderMove={move}
        >
          <Svg width="100%" height="100%" viewBox={`0 0 ${SIZE} ${SIZE}`} pointerEvents="none">
            {strokes.map((stroke, index) => (
              <Polyline key={index} points={stroke.map((p) => p.join(',')).join(' ')} fill="none" stroke="#173d34" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </Svg>
        </View>
        <Button title="Clear signature" icon={Eraser} variant="secondary" onPress={() => setStrokes([])} />
      </Card>
      <Button title="Save proof & mark delivered" icon={PenLine} disabled={busy} onPress={save} />
    </Screen>
  );
}
