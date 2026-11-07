// Root component — wires SafeAreaProvider, ToastProvider, SessionProvider,
// and RootNavigator into the delivery app entry point.

import '../global.css';

import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from '@/navigation/RootNavigator';
import { SessionProvider } from '@/session/SessionProvider';
import { ToastProvider } from '@/session/ToastProvider';

export default function App() {
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <SessionProvider>
          <StatusBar barStyle="light-content" />
          <RootNavigator />
        </SessionProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
