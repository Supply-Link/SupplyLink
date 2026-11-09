// ErrorBoundary — keeps a render error from blanking the whole app; offers a retry.

import { TriangleAlert } from 'lucide-react-native';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

interface State {
  failed: boolean;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (__DEV__) console.warn('Screen failed to render', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View className="flex-1 items-center justify-center bg-canvas px-8">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-brand-soft">
          <TriangleAlert size={30} color="#173d34" />
        </View>
        <Text className="mt-5 text-center text-xl font-bold text-ink">Something went wrong</Text>
        <Text className="mt-2 text-center text-[15px] leading-6 text-muted">
          This screen couldn't be shown. Your data is safe. Try again, or come back in a moment.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => this.setState({ failed: false })}
          className="mt-6 h-12 items-center justify-center rounded-xl bg-brand px-8 active:opacity-80"
        >
          <Text className="text-base font-semibold text-white">Try again</Text>
        </Pressable>
      </View>
    );
  }
}
