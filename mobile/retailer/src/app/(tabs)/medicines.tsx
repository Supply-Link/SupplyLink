// Medicines tab — searchable catalog with category chips, one-tap add with a
// quantity stepper, and a basket bar that follows the shopper.

import { useRouter } from '@/navigation/router';
import { ChevronRight, Minus, PackageSearch, Pill, Plus, ShoppingBasket } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Card, Chips, colors, EmptyState, Screen, SearchBar } from '@/components/ui';
import { money, percent } from '@/lib/rules';
import type { Product } from '@/lib/types';
import { useCart } from '@/session/CartProvider';
import { useSession } from '@/session/SessionProvider';

const LOW_STOCK = 20;

export default function MedicinesScreen() {
  const router = useRouter();
  const { workspace, user, refresh } = useSession();
  const cart = useCart();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const all = workspace?.products ?? [];
  const categories = useMemo(
    () => ['all', ...Array.from(new Set(all.map((p) => p.category).filter((c): c is string => !!c)))],
    [all],
  );

  const products = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all.filter(
      (p) =>
        (category === 'all' || p.category === category) &&
        [p.name, p.generic_name, p.category, p.manufacturer].join(' ').toLowerCase().includes(term),
    );
  }, [all, category, search]);

  const subtotal = [...cart.lines].reduce((sum, [id, qty]) => sum + (all.find((p) => p.id === id)?.price ?? 0) * qty, 0);

  const footer =
    cart.count > 0 ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View basket, ${cart.count} ${cart.count === 1 ? 'item' : 'items'}`}
        onPress={() => router.navigate('/basket')}
        className="mx-4 mb-3 mt-1 flex-row items-center rounded-2xl bg-brand px-4 py-3.5 active:opacity-90"
        style={{ elevation: 6 }}
      >
        <ShoppingBasket size={20} color="#fff" />
        <View className="ml-3 flex-1">
          <Text className="text-[15px] font-bold text-white">
            {cart.count} {cart.count === 1 ? 'item' : 'items'}
          </Text>
          <Text className="text-xs text-brand-mist">{money(subtotal)} excl. GST</Text>
        </View>
        <Text className="text-[15px] font-bold text-white">View basket</Text>
        <ChevronRight size={18} color="#fff" />
      </Pressable>
    ) : undefined;

  return (
    <Screen
      title="Medicines"
      subtitle={user?.business ?? user?.name}
      onRefresh={refresh}
      loading={!workspace}
      footer={footer}
    >
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search by name, generic, category…" />
      {categories.length > 2 ? (
        <Chips value={category} onChange={setCategory} options={categories.map((c) => ({ value: c, label: c === 'all' ? 'All' : c }))} />
      ) : null}

      {products.length === 0 ? (
        <EmptyState message={search || category !== 'all' ? 'No medicines match your search.' : 'No medicines are available right now.'} icon={PackageSearch} />
      ) : null}
      {products.map((p) => (
        <ProductRow key={p.id} product={p} />
      ))}
    </Screen>
  );
}

function ProductRow({ product: p }: { product: Product }) {
  const router = useRouter();
  const cart = useCart();
  const quantity = cart.lines.get(p.id) ?? 0;
  const out = p.stock <= 0;
  const low = !out && p.stock <= LOW_STOCK;

  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${p.name}, details`}
        onPress={() => router.push({ pathname: '/medicine/[id]', params: { id: p.id } })}
        className="flex-row items-center active:opacity-80"
      >
        <View className="h-[60px] w-[60px] items-center justify-center rounded-2xl bg-brand-soft">
          <Pill size={28} color={colors.brand} />
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-base font-bold text-ink" numberOfLines={2}>
            {p.name}
          </Text>
          <Text className="mt-0.5 text-[13px] text-muted" numberOfLines={1}>
            {[p.strength, p.unit].filter(Boolean).join(' · ')}
          </Text>
          <View className="mt-1.5 flex-row items-baseline">
            <Text className="text-[17px] font-bold text-ink">{money(p.price)}</Text>
            <Text className="ml-1.5 text-xs text-muted">+ GST {percent(p.gst_rate_bps)}</Text>
          </View>
          {out ? (
            <Text className="mt-1 text-xs font-semibold text-danger">Out of stock</Text>
          ) : low ? (
            <Text className="mt-1 text-xs font-semibold text-[#b26a00]">Only {p.stock} left</Text>
          ) : null}
        </View>
        <View className="ml-2 w-[92px] items-end">
          {out ? null : quantity === 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Add ${p.name} to basket`}
              onPress={() => cart.add(p)}
              className="h-10 w-[92px] items-center justify-center rounded-xl border-[1.5px] border-brand bg-white active:bg-brand-soft"
            >
              <Text className="text-sm font-bold tracking-wide text-brand">ADD</Text>
            </Pressable>
          ) : (
            <Pressable
              accessible={false}
              onPress={() => {}}
              className="h-10 w-[92px] flex-row items-center justify-between rounded-xl bg-brand px-1"
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Decrease ${p.name}`}
                hitSlop={6}
                onPress={() => (quantity <= 1 ? cart.remove(p.id) : cart.setQuantity(p, quantity - 1))}
                className="h-9 w-8 items-center justify-center"
              >
                <Minus size={16} color="#fff" />
              </Pressable>
              <Text className="text-[15px] font-bold text-white" accessibilityLabel={`Quantity ${quantity}`}>
                {quantity}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Increase ${p.name}`}
                hitSlop={6}
                onPress={() => cart.add(p)}
                className="h-9 w-8 items-center justify-center"
              >
                <Plus size={16} color="#fff" />
              </Pressable>
            </Pressable>
          )}
        </View>
      </Pressable>
    </Card>
  );
}
