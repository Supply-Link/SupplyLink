import { useRouter } from '@/navigation/router';
import { Cross, PackageSearch, Plus, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Button, Card, colors, EmptyState, Muted, Screen } from '@/components/ui';
import { money, percent } from '@/lib/rules';
import { useCart } from '@/session/CartProvider';
import { useSession } from '@/session/SessionProvider';

export default function MedicinesScreen() {
  const router = useRouter();
  const { workspace, user, refresh } = useSession();
  const cart = useCart();
  const [search, setSearch] = useState('');

  const products = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (workspace?.products ?? []).filter((p) =>
      [p.name, p.generic_name, p.category, p.manufacturer].join(' ').toLowerCase().includes(term),
    );
  }, [search, workspace]);

  return (
    <Screen title="Medicines" subtitle={user?.business ?? user?.name} onRefresh={refresh}>
      <View className="mt-2 flex-row items-center rounded-xl border border-[#dce4de] bg-white px-3">
        <Search size={18} color={colors.muted} />
        <TextInput
          accessibilityLabel="Search medicines"
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, generic, category…"
          placeholderTextColor="#9aa8a0"
          autoCorrect={false}
          returnKeyType="search"
          className="ml-2 flex-1 py-3 text-base text-ink"
        />
      </View>
      <Muted>Batch availability and GST are supplied by your distributor.</Muted>

      {products.length === 0 ? <EmptyState message="No medicines match your search." icon={PackageSearch} /> : null}
      {products.map((p) => (
        <Card key={p.id}>
          <View className="flex-row items-center">
            <Cross size={16} color={colors.brand} />
            <Text className="ml-2 flex-1 text-[19px] font-bold text-ink">{p.name}</Text>
          </View>
          <Muted>
            {p.manufacturer} · {p.unit}
          </Muted>
          <Text className="mt-1 text-base font-bold text-brand">
            {money(p.price)} excl. GST · {p.stock} available
          </Text>
          <Muted className="text-xs">
            HSN {p.hsn_code} · GST {percent(p.gst_rate_bps)}
          </Muted>
          <View className="flex-row">
            <Button
              title="Batch details"
              variant="secondary"
              className="mr-2 flex-1"
              onPress={() => router.push({ pathname: '/medicine/[id]', params: { id: p.id } })}
            />
            {p.stock > 0 ? (
              <Button title="Add" icon={Plus} className="flex-1" onPress={() => cart.add(p)} />
            ) : (
              <View className="mt-2.5 h-12 flex-1 items-center justify-center rounded-card bg-canvas">
                <Text className="font-semibold text-muted">Out of stock</Text>
              </View>
            )}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
