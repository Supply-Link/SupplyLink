package com.supplylink.mobile;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.json.JSONObject;

final class Api {
  String base, csrf = "";
  private final CookieManager cookies =
      new CookieManager(null, CookiePolicy.ACCEPT_ORIGINAL_SERVER);

  Api(String base) {
    this.base = base;
  }

  void clear() {
    cookies.getCookieStore().removeAll();
    csrf = "";
  }

  static final class Failure extends Exception {
    final int status;
    final JSONObject payload;

    Failure(int status, JSONObject payload) {
      super(payload.optString("error", "Server returned " + status));
      this.status = status;
      this.payload = payload;
    }
  }

  JSONObject call(String method, String path, JSONObject body, String key) throws Exception {
    URI uri = URI.create(base + path);
    HttpURLConnection c = (HttpURLConnection) uri.toURL().openConnection();
    c.setConnectTimeout(12000);
    c.setReadTimeout(20000);
    c.setInstanceFollowRedirects(false);
    c.setRequestMethod(method);
    c.setRequestProperty("Accept", "application/json");
    for (Map.Entry<String, List<String>> e : cookies.get(uri, Collections.emptyMap()).entrySet())
      c.setRequestProperty(e.getKey(), String.join("; ", e.getValue()));
    if (!csrf.isEmpty()) c.setRequestProperty("X-CSRF-Token", csrf);
    if (key != null) c.setRequestProperty("Idempotency-Key", key);
    try {
      if (body != null) {
        c.setDoOutput(true);
        c.setRequestProperty("Content-Type", "application/json");
        byte[] b = body.toString().getBytes(StandardCharsets.UTF_8);
        c.setFixedLengthStreamingMode(b.length);
        try (OutputStream o = c.getOutputStream()) {
          o.write(b);
        }
      }
      int status = c.getResponseCode();
      cookies.put(uri, c.getHeaderFields());
      InputStream input = status >= 400 ? c.getErrorStream() : c.getInputStream();
      if (input == null) throw new IOException("The server returned an empty response.");
      ByteArrayOutputStream bytes = new ByteArrayOutputStream();
      try (InputStream stream = input) {
        byte[] buffer = new byte[8192];
        int count;
        while ((count = stream.read(buffer)) != -1) {
          bytes.write(buffer, 0, count);
          if (bytes.size() > 4 * 1024 * 1024) throw new IOException("Response is too large.");
        }
      }
      JSONObject result;
      try {
        result = new JSONObject(bytes.toString("UTF-8"));
      } catch (Exception e) {
        throw new IOException("The server did not return SupplyLink JSON. Check the server URL.");
      }
      if (status < 200 || status >= 300) throw new Failure(status, result);
      if (result.has("csrf")) csrf = result.getString("csrf");
      return result;
    } finally {
      c.disconnect();
    }
  }
}
