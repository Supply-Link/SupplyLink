import { Platform } from 'react-native';

export const ROLE = 'delivery' as const;

export const APP = {
  roleLabel: 'Delivery',
  tagline: 'Every delivery, accounted for.',
  greeting: 'Your delivery desk for today.',
  businessLabel: 'Delivery team',
};

export const DEFAULT_SERVER = __DEV__
  ? Platform.OS === 'android'
    ? 'http://10.0.2.2:8080'
    : 'http://127.0.0.1:8080'
  : '';

export const SERVER_STORAGE_KEY = 'supplylink.server';
export const LICENCE_POLL_MS = 15000;
export const LOCATION_TIMEOUT_MS = 20000;
