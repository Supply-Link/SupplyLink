// Root component — wires SafeAreaProvider, ToastProvider, SessionProvider,
// CartProvider, and RootNavigator into the app entry point.

import '../global.css';

import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from '@/navigation/RootNavigator';
import { CartProvider } from '@/session/CartProvider';
import { SessionProvider } from '@/session/SessionProvider';
import { ToastProvider } from '@/session/ToastProvider';

export default function App() {
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <SessionProvider>
          <CartProvider>
            <StatusBar barStyle="light-content" />
            <RootNavigator />
          </CartProvider>
        </SessionProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
