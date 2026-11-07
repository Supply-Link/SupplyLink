import { Platform } from 'react-native';

export const ROLE = 'retailer' as const;

export const APP = {
  roleLabel: 'Retailer',
  tagline: 'Your pharmacy, connected.',
  greeting: 'Keep your shelves ready for care.',
  businessLabel: 'Pharmacy / business',
};

export const DEFAULT_SERVER = __DEV__
  ? Platform.OS === 'android'
    ? 'http://10.0.2.2:8080'
    : 'http://127.0.0.1:8080'
  : '';

export const SERVER_STORAGE_KEY = 'supplylink.server';
export const LICENCE_POLL_MS = 15000;
