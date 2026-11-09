// useRouter hook — maps file-style pathnames to React Navigation route
// names; push/navigate/back/dismissAll helpers for all retailer screens.

import { StackActions, useNavigation, useRoute } from '@react-navigation/native';
import type { NavigationProp, ParamListBase, RouteProp } from '@react-navigation/native';

type RouteTarget = string | { pathname: string; params?: Record<string, string> };

const tabRoutes: Record<string, string> = {
  '/': 'Home',
  '/medicines': 'Medicines',
  '/orders': 'Orders',
  '/basket': 'Basket',
  '/account': 'Account',
};

const stackRoutes: Record<string, string> = {
  '/register': 'Register',
  '/locked': 'Locked',
  '/medicine/[id]': 'MedicineDetails',
  '/order/[id]': 'OrderDetails',
  '/review': 'Review',
  '/business': 'Business',
  '/finance': 'Finance',
  '/alerts': 'Alerts',
  '/help': 'Help',
  '/records': 'Records',
  '/statement/[id]': 'StatementDetails',
  '/return/[id]': 'ReturnRequest',
};

/** A slow device queues taps while a screen is still opening; repeat taps must not open it again. */
const BACK_COOLDOWN_MS = 600;
let lastBack = 0;

function sameParams(a?: object, b?: object) {
  const left = (a ?? {}) as Record<string, unknown>;
  const right = (b ?? {}) as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => left[key] === right[key]);
}

function targetParts(target: RouteTarget) {
  if (typeof target === 'string') return { pathname: target, params: undefined };
  return { pathname: target.pathname, params: target.params };
}

function rootNavigation(navigation: NavigationProp<ParamListBase>) {
  let current = navigation;
  while (current.getParent()) current = current.getParent()!;
  return current;
}

export function useRouter() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const root = rootNavigation(navigation);

  function go(target: RouteTarget, method: 'navigate' | 'push') {
    const { pathname, params } = targetParts(target);
    const tab = tabRoutes[pathname];
    if (tab) {
      root.navigate('Tabs', { screen: tab });
      return;
    }

    const routeName = stackRoutes[pathname];
    if (!routeName) throw new Error(`Unknown app route: ${pathname}`);
    // Already showing (or opening) this exact screen: ignore the repeat tap.
    const state = root.getState();
    const top = state?.routes[state.index];
    if (top && top.name === routeName && sameParams(top.params, params)) return;
    if (method === 'push') root.dispatch(StackActions.push(routeName, params));
    else root.navigate(routeName, params);
  }

  return {
    push: (target: RouteTarget) => go(target, 'push'),
    navigate: (target: RouteTarget) => go(target, 'navigate'),
    back: () => {
      const now = Date.now();
      if (now - lastBack < BACK_COOLDOWN_MS) return; // a double tap would pop two screens
      lastBack = now;
      navigation.goBack();
    },
    dismissAll: () => root.reset({ index: 0, routes: [{ name: 'Tabs', params: { screen: 'Orders' } }] }),
  };
}

export function useLocalSearchParams<T extends Record<string, string | undefined>>() {
  const route = useRoute<RouteProp<ParamListBase>>();
  return (route.params ?? {}) as T;
}
