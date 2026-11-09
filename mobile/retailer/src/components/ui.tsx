// Design-system primitives shared across all retailer screens: Screen layout
// wrapper, Card, Button (primary/secondary/danger), Field, Segmented, Select,
// Dialog, EmptyState, Row, and typography helpers (Title, Body, Muted, SectionLabel).

import { ChevronDown, ChevronLeft, ChevronRight, Check, Cross, Eye, EyeOff, Search, WifiOff, X, type LucideIcon } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
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
import { useSession } from '@/session/SessionProvider';

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
  /** Shows placeholder cards instead of the content while data is still loading. */
  loading?: boolean;
  /** Custom placeholder shown while loading (defaults to a list of rows). */
  skeleton?: ReactNode;
  /** Pinned below the scrolling content (e.g. a basket bar or primary action). */
  footer?: ReactNode;
  children: ReactNode;
}

export function Screen({ title, subtitle, onBack, onRefresh, bottomInset, loading, skeleton, footer, children }: ScreenProps) {
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
      <OfflineBanner />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-4"
        contentContainerStyle={{ paddingBottom: (bottomInset ? insets.bottom : 0) + 28 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          pull ? <RefreshControl refreshing={refreshing} onRefresh={pull} tintColor={colors.brand} colors={[colors.brand]} /> : undefined
        }
      >
        {loading ? skeleton ?? <ScreenSkeleton /> : children}
      </ScrollView>
      {footer}
    </KeyboardAvoidingView>
  );
}

/** Shown under the header while the server can't be reached or saved changes are still syncing. */
export function OfflineBanner() {
  const { offline, lastSynced, pending, phase } = useSession();
  if (phase === 'signedOut' || (!offline && pending.length === 0)) return null;
  const when = lastSynced
    ? new Date(lastSynced).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '';
  const waiting = pending.length > 0 ? `${pending.length} ${pending.length === 1 ? 'change' : 'changes'} waiting to sync` : '';
  const text = offline
    ? ["You're offline", when ? `showing data from ${when}` : '', waiting].filter(Boolean).join(' · ')
    : `Syncing ${waiting.replace(' waiting to sync', '')}…`;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel={text}
      className="flex-row items-center bg-[#fff4d6] px-5 py-2"
    >
      <WifiOff size={14} color="#7a4b00" />
      <Text className="ml-2 flex-1 text-xs font-semibold text-[#7a4b00]">{text}</Text>
    </View>
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
  /** Rotates the icon, e.g. while a refresh is running. */
  spinning?: boolean;
  disabled?: boolean;
  className?: string;
}

/** Rotates its children continuously while `active`, and settles back to rest when it stops. */
function Spin({ active, children }: { active: boolean; children: ReactNode }) {
  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    turn.setValue(0);
    if (!active) return;
    const loop = Animated.loop(
      Animated.timing(turn, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => {
      loop.stop();
      // Native-driven values keep their last angle, so put the icon back at rest explicitly.
      turn.setValue(0);
    };
  }, [active, turn]);
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return <Animated.View style={{ transform: [{ rotate }] }}>{children}</Animated.View>;
}

/**
 * Wraps an async action for a spinning icon button: `spinning` stays true while it runs (and for at
 * least a moment, so a fast refresh still gives feedback); taps while it is running are ignored.
 */
export function useSpinningAction(action: () => Promise<unknown>) {
  const [spinning, setSpinning] = useState(false);
  const run = async () => {
    if (spinning) return;
    setSpinning(true);
    try {
      await Promise.all([action(), new Promise<void>((done) => setTimeout(done, 800))]);
    } finally {
      setSpinning(false);
    }
  };
  return { spinning, run };
}

/**
 * Lets a handler run once per tap burst: further taps are ignored while an async handler is still
 * running, and for a short cooldown afterwards. Stops slow devices opening a screen or sending a
 * request several times from repeated taps.
 */
export function useSingleTap(handler?: () => unknown, cooldownMs = 600) {
  const locked = useRef(false);
  return useCallback(() => {
    if (locked.current) return;
    locked.current = true;
    const release = () => setTimeout(() => (locked.current = false), cooldownMs);
    try {
      const result = handler?.();
      if (result instanceof Promise) result.then(release, release);
      else release();
    } catch (error) {
      release();
      throw error;
    }
  }, [handler, cooldownMs]);
}

export function Button({ title, onPress, variant = 'primary', icon: Icon, spinning, disabled, className = '' }: ButtonProps) {
  const style = buttonStyles[variant];
  const press = useSingleTap(onPress);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={press}
      className={`mt-2.5 h-12 flex-row items-center justify-center rounded-xl px-4 active:opacity-75 active:scale-[0.98] ${style.box} ${disabled ? 'opacity-50' : ''} ${className}`}
    >
      {Icon ? (
        <Spin active={spinning === true}>
          <Icon size={18} color={style.icon} />
        </Spin>
      ) : null}
      <Text className={`text-base font-semibold ${Icon ? 'ml-2' : ''} ${style.text}`}>{title}</Text>
    </Pressable>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <Text className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">{children}</Text>;
}

export function Field({ label, secureTextEntry, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const [hidden, setHidden] = useState(true);
  const isPassword = secureTextEntry === true;
  return (
    <View className="mt-3">
      <FieldLabel>{label}</FieldLabel>
      <View className="justify-center">
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor="#9aa8a0"
          className={`rounded-xl bg-canvas px-3 py-3 text-base text-ink${isPassword ? ' pr-12' : ''}${error ? ' border border-danger' : ''}`}
          secureTextEntry={isPassword && hidden}
          {...props}
        />
        {isPassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            hitSlop={8}
            onPress={() => setHidden((value) => !value)}
            className="absolute right-0 h-full justify-center px-3"
          >
            {hidden ? <Eye color={colors.muted} size={20} /> : <EyeOff color={colors.muted} size={20} />}
          </Pressable>
        ) : null}
      </View>
      {error ? <Text className="mt-1 text-xs font-medium text-danger">{error}</Text> : null}
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
  const confirm = useSingleTap(onConfirm);
  const cancel = useSingleTap(onCancel);
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
            <Pressable accessibilityRole="button" onPress={cancel} className="rounded-xl px-4 py-3">
              <Text className="font-semibold text-muted">Back</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={confirm} className="ml-2 rounded-xl bg-brand px-5 py-3">
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


// ── Loading placeholders ───────────────────────────────────────────────────

/** A softly pulsing grey block used while content loads. */
export function Skeleton({ width, height = 14, radius = 8, style }: { width?: number | `${number}%`; height?: number; radius?: number; style?: object }) {
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 750, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={[{ width: width ?? '100%', height, borderRadius: radius, backgroundColor: '#dfe6df', opacity: pulse }, style]} />;
}

/** A list-row shaped placeholder: icon tile, two text lines and an action stub. */
export function SkeletonRow() {
  return (
    <Card>
      <View className="flex-row items-center">
        <Skeleton width={52} height={52} radius={14} />
        <View className="ml-3 flex-1">
          <Skeleton width="70%" height={16} />
          <Skeleton width="45%" height={12} style={{ marginTop: 8 }} />
          <Skeleton width="30%" height={14} style={{ marginTop: 8 }} />
        </View>
        <Skeleton width={64} height={36} radius={10} />
      </View>
    </Card>
  );
}

export function ScreenSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View accessibilityLabel="Loading" accessibilityLiveRegion="polite">
      <Skeleton height={46} radius={14} style={{ marginTop: 8 }} />
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  );
}

// ── Search, filters and menu rows ──────────────────────────────────────────

export function SearchBar({ value, onChangeText, placeholder }: { value: string; onChangeText: (v: string) => void; placeholder: string }) {
  return (
    <View className="mt-2 flex-row items-center rounded-2xl border border-line bg-white px-3.5" style={{ elevation: 1 }}>
      <Search size={18} color={colors.muted} />
      <TextInput
        accessibilityLabel={placeholder}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9aa8a0"
        autoCorrect={false}
        returnKeyType="search"
        className="ml-2 flex-1 py-3 text-base text-ink"
      />
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10} onPress={() => onChangeText('')}>
          <X size={18} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Horizontally scrolling filter pills (like category chips on a shopping app). */
export function Chips<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3 -mx-5" contentContainerClassName="px-5">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            className={`mr-2 rounded-full border px-4 py-2 ${selected ? 'border-brand bg-brand' : 'border-line bg-white'}`}
          >
            <Text className={`text-sm font-semibold ${selected ? 'text-white' : 'text-ink'}`}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** A tappable settings-style row: icon, label, optional hint and a chevron. */
export function MenuRow({ icon: Icon, label, hint, onPress, danger }: { icon: LucideIcon; label: string; hint?: string; onPress: () => void; danger?: boolean }) {
  const press = useSingleTap(onPress);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={press}
      className={`flex-row items-center py-3.5 active:opacity-70 ${danger ? '' : 'border-b border-line'}`}
    >
      <View className={`h-10 w-10 items-center justify-center rounded-xl ${danger ? 'bg-red-50' : 'bg-brand-soft'}`}>
        <Icon size={20} color={danger ? colors.danger : colors.brand} />
      </View>
      <View className="ml-3 flex-1">
        <Text className={`text-base font-semibold ${danger ? 'text-danger' : 'text-ink'}`}>{label}</Text>
        {hint ? <Text className="text-[13px] text-muted">{hint}</Text> : null}
      </View>
      {danger ? null : <ChevronRight size={18} color={colors.muted} />}
    </Pressable>
  );
}
