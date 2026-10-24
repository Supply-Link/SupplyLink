package com.supplylink.mobile;

import java.net.URI;
import java.text.NumberFormat;
import java.util.Locale;

public final class Rules {
  private Rules() {}

  public static String server(String input, boolean debug) {
    URI uri;
    try {
      uri = URI.create(input.trim());
    } catch (Exception e) {
      throw new IllegalArgumentException("Enter a valid server URL.");
    }
    String scheme = uri.getScheme();
    if (uri.getHost() == null
        || uri.getUserInfo() != null
        || uri.getQuery() != null
        || uri.getFragment() != null
        || (uri.getPath() != null && !uri.getPath().isEmpty() && !uri.getPath().equals("/"))
        || !("https".equals(scheme) || debug && "http".equals(scheme)))
      throw new IllegalArgumentException(
          debug
              ? "Use an http:// or https:// server URL, without a path."
              : "Use an HTTPS server URL, without a path.");
    return scheme + "://" + uri.getRawAuthority();
  }

  public static String money(long paise) {
    return NumberFormat.getCurrencyInstance(new Locale("en", "IN")).format(paise / 100.0);
  }

  public static boolean cancellable(String status, String payment) {
    return (status.equals("placed") || status.equals("confirmed")) && !payment.equals("paid");
  }

  public static String stage(String status) {
    switch (status) {
      case "placed":
        return "▤  Placed";
      case "confirmed":
        return "✓  Confirmed";
      case "packed":
        return "▣  Packed";
      case "out_for_delivery":
        return "➜  Out for delivery";
      case "delivered":
        return "✓  Delivered";
      case "cancelled":
        return "×  Cancelled";
      default:
        return status;
    }
  }

  public static double coordinate(String value, double limit) {
    double n;
    try {
      n = Double.parseDouble(value.trim());
    } catch (Exception e) {
      throw new IllegalArgumentException("Enter valid coordinates.");
    }
    if (!Double.isFinite(n) || Math.abs(n) > limit)
      throw new IllegalArgumentException("Coordinates are outside the valid range.");
    return n;
  }
}
