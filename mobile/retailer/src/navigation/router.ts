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
    if (method === 'push') root.dispatch(StackActions.push(routeName, params));
    else root.navigate(routeName, params);
  }

  return {
    push: (target: RouteTarget) => go(target, 'push'),
    navigate: (target: RouteTarget) => go(target, 'navigate'),
    back: () => navigation.goBack(),
    dismissAll: () => root.reset({ index: 0, routes: [{ name: 'Tabs', params: { screen: 'Orders' } }] }),
  };
}

export function useLocalSearchParams<T extends Record<string, string | undefined>>() {
  const route = useRoute<RouteProp<ParamListBase>>();
  return (route.params ?? {}) as T;
}
