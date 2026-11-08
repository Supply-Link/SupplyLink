// RootNavigator — NavigationContainer with phase-gated screens:
// signedOut → SignIn/Register, locked → Locked, ready → Tabs + detail screens.

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View } from 'react-native';
import TabNavigator from './TabNavigator';
import SignInScreen from '@/app/sign-in';
import RegisterScreen from '@/app/register';
import LockedScreen from '@/app/locked';
import OrderScreen from '@/app/order/[id]';
import ProofScreen from '@/app/proof/[id]';
import HelpScreen from '@/app/help';
import { useSession } from '@/session/SessionProvider';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { hydrated, phase } = useSession();
  if (!hydrated) return <View style={{ flex: 1, backgroundColor: '#173d34' }} />;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#f6f7f3' } }}>
        {phase === 'signedOut' ? (
          <>
            <Stack.Screen name="SignIn" component={SignInScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : null}
        {phase === 'locked' ? <Stack.Screen name="Locked" component={LockedScreen} /> : null}
        {phase === 'ready' ? (
          <>
            <Stack.Screen name="Tabs" component={TabNavigator} />
            <Stack.Screen name="OrderDetails" component={OrderScreen} />
            <Stack.Screen name="Proof" component={ProofScreen} />
            <Stack.Screen name="Help" component={HelpScreen} />
          </>
        ) : null}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
