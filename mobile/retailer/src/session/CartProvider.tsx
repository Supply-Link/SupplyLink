import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Product, Quote } from '@/lib/types';
import { useSession } from './SessionProvider';
import { useToast } from './ToastProvider';

export const CHECKOUT_SCOPE = 'checkout';

export interface Checkout {
  quote: Quote;
  address: string;
  stateCode: string;
  method: 'cod' | 'credit';
}

interface Cart {
  lines: Map<string, number>;
  count: number;
  add(product: Product): void;
  setQuantity(product: Product, quantity: number): boolean;
  remove(productId: string): void;
  clear(): void;
  items(): { product_id: string; quantity: number }[];
  checkout: Checkout | null;
  setCheckout(value: Checkout | null): void;
}

interface Basket {
  epoch: number;
  lines: Map<string, number>;
  checkout: Checkout | null;
}

const CartContext = createContext<Cart | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { epoch, dropKey, showError } = useSession();
  const toast = useToast();
  const [basket, setBasket] = useState<Basket>({ epoch, lines: new Map(), checkout: null });

  // A basket from before the last purge (sign-out, licence lock) is discarded.
  const current = basket.epoch === epoch;
  const lines = useMemo(() => (current ? basket.lines : new Map<string, number>()), [basket.lines, current]);
  const checkout = current ? basket.checkout : null;

  const changed = useCallback(
    (next: Map<string, number>) => {
      setBasket({ epoch, lines: next, checkout: null });
      dropKey(CHECKOUT_SCOPE);
    },
    [dropKey, epoch],
  );

  const add = useCallback(
    (product: Product) => {
      const quantity = (lines.get(product.id) ?? 0) + 1;
      if (quantity > product.stock) {
        toast('Available stock reached.');
        return;
      }
      changed(new Map(lines).set(product.id, quantity));
      toast(`Added to basket · ${quantity} × ${product.name}`);
    },
    [changed, lines, toast],
  );

  const setQuantity = useCallback(
    (product: Product, quantity: number) => {
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > product.stock) {
        showError(`Choose between 1 and ${product.stock} units.`);
        return false;
      }
      changed(new Map(lines).set(product.id, quantity));
      return true;
    },
    [changed, lines, showError],
  );

  const remove = useCallback(
    (productId: string) => {
      const next = new Map(lines);
      next.delete(productId);
      changed(next);
    },
    [changed, lines],
  );

  const clear = useCallback(() => changed(new Map()), [changed]);

  const setCheckout = useCallback(
    (value: Checkout | null) =>
      setBasket((b) => (b.epoch === epoch ? { ...b, checkout: value } : { epoch, lines: new Map(), checkout: value })),
    [epoch],
  );

  const value = useMemo<Cart>(
    () => ({
      lines,
      count: [...lines.values()].reduce((sum, n) => sum + n, 0),
      add,
      setQuantity,
      remove,
      clear,
      items: () => [...lines].map(([product_id, quantity]) => ({ product_id, quantity })),
      checkout,
      setCheckout,
    }),
    [add, checkout, clear, lines, remove, setCheckout, setQuantity],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): Cart {
  const cart = useContext(CartContext);
  if (!cart) throw new Error('useCart must be used inside CartProvider');
  return cart;
}
