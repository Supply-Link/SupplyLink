import Geolocation from '@react-native-community/geolocation';
import { PermissionsAndroid, Platform } from 'react-native';
import { LOCATION_TIMEOUT_MS } from './config';

export interface Fix {
  latitude: number;
  longitude: number;
  source: string;
}

async function requestLocationPermission() {
  if (Platform.OS !== 'android') return false;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
    title: 'Share delivery location',
    message: 'SupplyLink uses your location once when you confirm it for an active delivery.',
    buttonPositive: 'Allow',
    buttonNegative: 'Cancel',
  });
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

/** One foreground fix. Resolves to a message string when no fix is available. */
export async function currentFix(onSearching: () => void): Promise<Fix | string> {
  if (!(await requestLocationPermission())) return 'Location denied. You can enter coordinates manually.';

  onSearching();
  return new Promise((resolve) => {
    Geolocation.getCurrentPosition(
      ({ coords }) => {
        const accuracy = coords.accuracy;
        resolve({
          latitude: coords.latitude,
          longitude: coords.longitude,
          source: accuracy == null
            ? 'Current device location'
            : `Current device location · accuracy ±${Math.round(accuracy)} m`,
        });
      },
      (error) => {
        resolve(error.code === 3
          ? 'Location timed out. Try outdoors or enter coordinates manually.'
          : 'Location is unavailable. Enable device location or enter coordinates manually.');
      },
      { enableHighAccuracy: true, timeout: LOCATION_TIMEOUT_MS, maximumAge: 0 },
    );
  });
}
