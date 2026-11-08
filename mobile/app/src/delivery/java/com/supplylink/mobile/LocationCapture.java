package com.supplylink.mobile;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.location.*;
import android.os.*;
import android.widget.Toast;

/** One foreground fix, followed by a separate explicit share confirmation. */
final class LocationCapture {
  interface Result {
    void received(double lat, double lon, String source);
  }

  private final Activity activity;
  private final Handler handler = new Handler(Looper.getMainLooper());
  private final LocationManager manager;
  private LocationListener listener;
  private Result pending;
  private final Runnable timeout =
      () -> {
        if (listener != null) {
          stop();
          message("Location timed out. Try outdoors or enter coordinates manually.");
        }
      };

  LocationCapture(Activity activity) {
    this.activity = activity;
    manager = (LocationManager) activity.getSystemService(Activity.LOCATION_SERVICE);
  }

  void start(Result result) {
    pending = result;
    if (activity.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        && activity.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)
            != PackageManager.PERMISSION_GRANTED) {
      activity.requestPermissions(
          new String[] {
            Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION
          },
          10);
      return;
    }
    stop();
    try {
      String provider =
          manager.isProviderEnabled(LocationManager.GPS_PROVIDER)
              ? LocationManager.GPS_PROVIDER
              : LocationManager.NETWORK_PROVIDER;
      if (!manager.isProviderEnabled(provider)) {
        message("Enable device location or enter coordinates manually.");
        return;
      }
      listener =
          new LocationListener() {
            public void onLocationChanged(Location location) {
              stop();
              result.received(
                  location.getLatitude(),
                  location.getLongitude(),
                  "Current device location · accuracy ±"
                      + Math.round(location.getAccuracy())
                      + " m");
            }

            public void onProviderEnabled(String p) {}

            public void onProviderDisabled(String p) {}

            public void onStatusChanged(String p, int s, Bundle b) {}
          };
      manager.requestSingleUpdate(provider, listener, Looper.getMainLooper());
      handler.postDelayed(timeout, 20000);
      message("Finding your location…");
    } catch (SecurityException e) {
      stop();
      message("Location permission is required.");
    } catch (IllegalArgumentException e) {
      stop();
      message("Location is unavailable. Enter coordinates manually.");
    }
  }

  void permissionResult() {
    if (activity.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED
        || activity.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)
            == PackageManager.PERMISSION_GRANTED) {
      if (pending != null) start(pending);
    } else message("Location denied. You can enter coordinates manually.");
  }

  void stop() {
    handler.removeCallbacks(timeout);
    if (listener != null) manager.removeUpdates(listener);
    listener = null;
  }

  private void message(String text) {
    Toast.makeText(activity, text, Toast.LENGTH_LONG).show();
  }
}
