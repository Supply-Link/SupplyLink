package com.supplylink.mobile;

import android.app.Activity;

/** Retailer build has no location implementation or location permissions. */
final class LocationCapture {
  interface Result {
    void received(double lat, double lon, String source);
  }

  LocationCapture(Activity activity) {}

  void start(Result result) {}

  void permissionResult() {}

  void stop() {}
}
