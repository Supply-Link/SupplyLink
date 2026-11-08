// RootNavigator — NavigationContainer with phase-gated screens:
// signedOut → SignIn/Register, locked → Locked, ready → Tabs + detail screens.

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View } from 'react-native';
import HomeTabs from './TabNavigator';
import SignInScreen from '@/app/sign-in';
import RegisterScreen from '@/app/register';
import LockedScreen from '@/app/locked';
import ReviewScreen from '@/app/review';
import BusinessScreen from '@/app/business';
import FinanceScreen from '@/app/finance';
import AlertsScreen from '@/app/alerts';
import HelpScreen from '@/app/help';
import RecordsScreen from '@/app/records';
import MedicineScreen from '@/app/medicine/[id]';
import OrderScreen from '@/app/order/[id]';
import StatementScreen from '@/app/statement/[id]';
import ReturnScreen from '@/app/return/[id]';
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
            <Stack.Screen name="Tabs" component={HomeTabs} />
            <Stack.Screen name="Review" component={ReviewScreen} />
            <Stack.Screen name="Business" component={BusinessScreen} />
            <Stack.Screen name="Finance" component={FinanceScreen} />
            <Stack.Screen name="Alerts" component={AlertsScreen} />
            <Stack.Screen name="Help" component={HelpScreen} />
            <Stack.Screen name="Records" component={RecordsScreen} />
            <Stack.Screen name="MedicineDetails" component={MedicineScreen} />
            <Stack.Screen name="OrderDetails" component={OrderScreen} />
            <Stack.Screen name="StatementDetails" component={StatementScreen} />
            <Stack.Screen name="ReturnRequest" component={ReturnScreen} />
          </>
        ) : null}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
