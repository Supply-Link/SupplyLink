import * as Location from 'expo-location';
import { LOCATION_TIMEOUT_MS } from './config';

export interface Fix {
  latitude: number;
  longitude: number;
  source: string;
}

/** One foreground fix. Resolves to a message string when no fix is available. */
export async function currentFix(onSearching: () => void): Promise<Fix | string> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') return 'Location denied. You can enter coordinates manually.';
  if (!(await Location.hasServicesEnabledAsync())) {
    return 'Enable device location or enter coordinates manually.';
  }

  onSearching();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), LOCATION_TIMEOUT_MS);
  });
  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      timeout,
    ]);
    if (!position) return 'Location timed out. Try outdoors or enter coordinates manually.';
    const accuracy = position.coords.accuracy;
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      source:
        accuracy == null
          ? 'Current device location'
          : `Current device location · accuracy ±${Math.round(accuracy)} m`,
    };
  } catch {
    return 'Location is unavailable. Enter coordinates manually.';
  } finally {
    clearTimeout(timer);
  }
}
