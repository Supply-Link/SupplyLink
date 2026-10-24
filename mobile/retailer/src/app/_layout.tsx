import '../../global.css';

import { preventScreenCaptureAsync } from 'expo-screen-capture';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CartProvider } from '@/session/CartProvider';
import { SessionProvider, useSession } from '@/session/SessionProvider';
import { ToastProvider } from '@/session/ToastProvider';

export default function RootLayout() {
  useEffect(() => {
    if (!__DEV__) void preventScreenCaptureAsync();
  }, []);

  return (
    <SafeAreaProvider>
      <ToastProvider>
        <SessionProvider>
          <CartProvider>
            <StatusBar style="light" />
            <Routes />
          </CartProvider>
        </SessionProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}

function Routes() {
  const { hydrated, phase } = useSession();
  if (!hydrated) return <View className="flex-1 bg-brand" />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#f4f7f4' } }}>
      <Stack.Protected guard={phase === 'signedOut'}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="register" />
      </Stack.Protected>
      <Stack.Protected guard={phase === 'locked'}>
        <Stack.Screen name="locked" />
      </Stack.Protected>
      <Stack.Protected guard={phase === 'ready'}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="medicine/[id]" />
        <Stack.Screen name="order/[id]" />
        <Stack.Screen name="review" />
        <Stack.Screen name="business" />
        <Stack.Screen name="alerts" />
      </Stack.Protected>
    </Stack>
  );
}
