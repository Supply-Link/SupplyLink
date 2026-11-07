// App configuration — ROLE constant, copy strings, server URL from .env,
// AsyncStorage key, and licence-poll interval.

// @ts-ignore — resolved by babel-plugin react-native-dotenv at build time
import { SERVER_URL } from '@env';

export const ROLE = 'retailer' as const;

export const APP = {
  roleLabel: 'Retailer',
  tagline: 'Your pharmacy, connected.',
  greeting: 'Keep your shelves ready for care.',
  businessLabel: 'Pharmacy / business',
};

export const DEFAULT_SERVER: string = SERVER_URL || 'https://supplylink-2.onrender.com';

export const SERVER_STORAGE_KEY = 'supplylink.server';
export const LICENCE_POLL_MS = 15000;
