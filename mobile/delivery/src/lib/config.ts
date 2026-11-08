// App configuration — ROLE constant, copy strings, server URL from .env,
// AsyncStorage key, licence-poll interval, and location timeout.

// @ts-ignore — resolved by babel-plugin react-native-dotenv at build time
import { SERVER_URL } from '@env';

export const ROLE = 'delivery' as const;

export const APP = {
  roleLabel: 'Delivery',
  tagline: 'Every delivery, accounted for.',
  greeting: 'Your delivery desk for today.',
  businessLabel: 'Delivery team',
};

export const DEFAULT_SERVER: string = SERVER_URL || 'https://supplylink-2.onrender.com';

export const SERVER_STORAGE_KEY = 'supplylink.server';
export const LICENCE_POLL_MS = 15000;
export const LOCATION_TIMEOUT_MS = 20000;
