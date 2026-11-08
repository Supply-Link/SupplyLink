// Design-system primitives shared across all retailer screens: Screen layout
// wrapper, Card, Button (primary/secondary/danger), Field, Segmented, Select,
// Dialog, EmptyState, Row, and typography helpers (Title, Body, Muted, SectionLabel).

import { ChevronDown, ChevronLeft, Check, Cross, type LucideIcon } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP } from '@/lib/config';

export const colors = {
  brand: '#173d34',
  ink: '#243c33',
  muted: '#7c827e',
  soft: '#edf3e7',
  danger: '#a54542',
  white: '#ffffff',
};

interface ScreenProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onRefresh?: () => Promise<void>;
  /** Stack screens draw to the bottom edge; tab screens sit above the tab bar. */
  bottomInset?: boolean;
  children: ReactNode;
}

export function Screen({ title, subtitle, onBack, onRefresh, bottomInset, children }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const pull = onRefresh
    ? async () => {
        setRefreshing(true);
        await onRefresh();
        setRefreshing(false);
      }
    : undefined;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-canvas"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className="bg-brand px-5 pb-5" style={{ paddingTop: insets.top + 12 }}>
        <View className="flex-row items-center">
          {onBack ? (
            <Pressable
              onPress={onBack}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Back"
              className="-ml-1 mr-2"
            >
              <ChevronLeft color={colors.white} size={22} />
            </Pressable>
          ) : null}
          <Cross color={colors.soft} size={12} />
          <Text className="ml-2 text-xs font-bold tracking-widest text-brand-soft">
            SUPPLYLINK / {APP.roleLabel.toUpperCase()}
          </Text>
        </View>
        <Text className="mt-3 text-[28px] font-semibold tracking-tight text-white" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? <Text className="mt-1 text-[13px] text-brand-mist">{subtitle}</Text> : null}
      </View>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-4"
        contentContainerStyle={{ paddingBottom: (bottomInset ? insets.bottom : 0) + 28 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          pull ? <RefreshControl refreshing={refreshing} onRefresh={pull} tintColor={colors.brand} colors={[colors.brand]} /> : undefined
        }
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <View
      className={`mt-3 rounded-2xl bg-white px-4 py-4 ${className}`}
      style={{ elevation: 2, shadowColor: '#173d34', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4 }}
    >
      {children}
    </View>
  );
}

export function Title({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <Text className={`text-xl font-bold text-ink ${className}`}>{children}</Text>;
}

export function Body({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <Text className={`mt-1 text-base leading-6 text-ink ${className}`}>{children}</Text>;
}

export function Muted({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <Text className={`mt-1 text-[13px] leading-5 text-muted ${className}`}>{children}</Text>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text className="mt-6 text-xs font-bold uppercase tracking-widest text-muted">{children}</Text>;
}

type Variant = 'primary' | 'secondary' | 'danger';

const buttonStyles: Record<Variant, { box: string; text: string; icon: string }> = {
  primary: { box: 'bg-brand', text: 'text-white', icon: colors.white },
  secondary: { box: 'bg-brand-soft', text: 'text-brand', icon: colors.brand },
  danger: { box: 'bg-red-50', text: 'text-danger', icon: colors.danger },
};

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  icon?: LucideIcon;
  disabled?: boolean;
  className?: string;
}

export function Button({ title, onPress, variant = 'primary', icon: Icon, disabled, className = '' }: ButtonProps) {
  const style = buttonStyles[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`mt-2.5 h-12 flex-row items-center justify-center rounded-xl px-4 active:opacity-75 active:scale-[0.98] ${style.box} ${disabled ? 'opacity-50' : ''} ${className}`}
    >
      {Icon ? <Icon size={18} color={style.icon} /> : null}
      <Text className={`text-base font-semibold ${Icon ? 'ml-2' : ''} ${style.text}`}>{title}</Text>
    </Pressable>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <Text className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">{children}</Text>;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View className="mt-3">
      <FieldLabel>{label}</FieldLabel>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#9aa8a0"
        className="rounded-xl bg-canvas px-3 py-3 text-base text-ink"
        {...props}
      />
    </View>
  );
}

interface Option<T extends string> {
  value: T;
  label: string;
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <View className="mt-3">
      <FieldLabel>{label}</FieldLabel>
      <View className="flex-row rounded-xl bg-canvas p-1">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              className={`flex-1 items-center rounded-lg py-2.5 ${selected ? 'bg-brand' : ''}`}
            >
              <Text className={`text-sm font-semibold ${selected ? 'text-white' : 'text-ink'}`}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option<string>[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const current = options.find((option) => option.value === value);

  return (
    <View className="mt-3">
      <FieldLabel>{label}</FieldLabel>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? 'not selected'}`}
        onPress={() => setOpen(true)}
        className="flex-row items-center justify-between rounded-xl border border-line bg-white px-3 py-3"
      >
        <Text className="flex-1 text-base text-ink" numberOfLines={1}>
          {current?.label ?? 'Select…'}
        </Text>
        <ChevronDown size={18} color={colors.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <Pressable className="flex-1" accessibilityLabel="Close" onPress={() => setOpen(false)} />
          <View className="max-h-[70%] rounded-t-3xl bg-white" style={{ paddingBottom: insets.bottom + 12 }}>
            <Text className="px-5 pb-2 pt-5 text-lg font-bold text-ink">{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  className="flex-row items-center justify-between border-b border-line px-5 py-3.5 active:bg-canvas"
                >
                  <Text className="flex-1 text-base text-ink">{item.label}</Text>
                  {item.value === value ? <Check size={18} color={colors.brand} /> : null}
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

interface DialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

export function Dialog({ visible, title, message, confirmLabel, onConfirm, onCancel, children }: DialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 items-center justify-center bg-black/40 px-6"
      >
        <View className="w-full rounded-3xl bg-white p-5">
          <Title>{title}</Title>
          {message ? <Muted className="text-sm">{message}</Muted> : null}
          {children}
          <View className="mt-4 flex-row justify-end">
            <Pressable accessibilityRole="button" onPress={onCancel} className="rounded-xl px-4 py-3">
              <Text className="font-semibold text-muted">Back</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onConfirm} className="ml-2 rounded-xl bg-brand px-5 py-3">
              <Text className="font-semibold text-white">{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function EmptyState({ message, icon: Icon }: { message: string; icon?: LucideIcon }) {
  return (
    <Card className="items-center py-8">
      {Icon ? <Icon size={28} color={colors.muted} /> : null}
      <Text className="mt-2 text-center text-base text-muted">{message}</Text>
    </Card>
  );
}

export function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View className={`flex-row items-center justify-between py-1 ${strong ? 'mt-1.5 border-t border-line pt-2.5' : ''}`}>
      <Text className={strong ? 'text-base font-bold text-ink' : 'text-sm text-muted'}>{label}</Text>
      <Text className={strong ? 'text-xl font-bold text-brand' : 'text-sm font-medium text-ink'}>{value}</Text>
    </View>
  );
}
