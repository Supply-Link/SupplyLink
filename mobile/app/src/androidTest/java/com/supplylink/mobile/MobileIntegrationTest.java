package com.supplylink.mobile;

import android.test.ActivityInstrumentationTestCase2;
import android.view.*;
import android.widget.*;
import java.util.*;
import org.json.*;

/** Exercises the actual Android HTTP stack and native screens against disposable QA servers. */
@SuppressWarnings("deprecation")
public class MobileIntegrationTest extends ActivityInstrumentationTestCase2<MainActivity> {
  public MobileIntegrationTest() {
    super(MainActivity.class);
  }

  private int activePort() {
    return BuildConfig.ROLE.equals("retailer") ? 18001 : 18004;
  }

  private JSONObject obj(Object... p) throws Exception {
    JSONObject o = new JSONObject();
    for (int i = 0; i < p.length; i += 2) o.put((String) p[i], p[i + 1]);
    return o;
  }

  private Api login(String role, int port) throws Exception {
    Api a = new Api("http://10.0.2.2:" + port);
    a.call(
        "POST",
        "/api/login",
        obj("email", role + "@supplylink.local", "password", "Demo@123"),
        null);
    return a;
  }

  private void expect(Api a, String method, String path, JSONObject body, int status)
      throws Exception {
    try {
      a.call(method, path, body, null);
      fail("Expected " + status + " for " + path);
    } catch (Api.Failure e) {
      assertEquals(e.getMessage(), status, e.status);
    }
  }

  public void testAndroidTransportCookiesCsrfAndRoleIsolation() throws Exception {
    Api a = login(BuildConfig.ROLE, activePort());
    JSONObject state = a.call("GET", "/api/state", null, null);
    assertEquals(BuildConfig.ROLE, state.getJSONObject("user").getString("role"));
    String csrf = a.csrf;
    a.csrf = "incorrect";
    expect(a, "POST", "/api/notifications/read", obj(), 403);
    a.csrf = csrf;
    a.call("POST", "/api/notifications/read", obj(), null);
    expect(a, "POST", "/api/users", obj(), 403);
    a.call("POST", "/api/logout", obj(), null);
    expect(a, "GET", "/api/state", null, 401);
  }

  public void testUnconfiguredAndExpiredAllowOnlyLogin() throws Exception {
    for (int port : new int[] {18002, 18003}) {
      Api a = login(BuildConfig.ROLE, port);
      JSONObject me = a.call("GET", "/api/me", null, null);
      assertFalse(me.getJSONObject("license").getBoolean("usable"));
      assertFalse(me.getJSONObject("user").has("credit_limit"));
      expect(a, "GET", "/api/state", null, 423);
      expect(a, "POST", "/api/orders", obj(), 423);
      expect(a, "POST", "/api/tracking", obj(), 423);
      a.call("POST", "/api/logout", obj(), null);
    }
  }

  public void testRegistrationRequiresAdministratorApproval() throws Exception {
    String email = "android-" + BuildConfig.ROLE + "-" + UUID.randomUUID() + "@example.test";
    Api a = new Api("http://10.0.2.2:" + activePort());
    a.call(
        "POST",
        "/api/register",
        obj(
            "name",
            "Android QA",
            "business",
            "QA pharmacy",
            "email",
            email,
            "password",
            "TestPassword123",
            "address",
            "QA Street Bengaluru",
            "state_code",
            "29",
            "role",
            BuildConfig.ROLE),
        null);
    expect(a, "POST", "/api/login", obj("email", email, "password", "TestPassword123"), 401);
    Api admin = login("admin", activePort());
    JSONArray users = admin.call("GET", "/api/state", null, null).getJSONArray("users");
    String id = "";
    for (int i = 0; i < users.length(); i++)
      if (users.getJSONObject(i).optString("email").equals(email))
        id = users.getJSONObject(i).getString("id");
    assertFalse(id.isEmpty());
    admin.call("POST", "/api/registrations/approve", obj("user_id", id), null);
    JSONObject result =
        a.call("POST", "/api/login", obj("email", email, "password", "TestPassword123"), null);
    assertEquals(BuildConfig.ROLE, result.getJSONObject("user").getString("role"));
  }

  public void testMedicineQuoteOrderDeliveryAndCollection() throws Exception {
    Api retailer = login("retailer", activePort()),
        distributor = login("distributor", activePort()),
        delivery = login("delivery", activePort());
    JSONObject state = retailer.call("GET", "/api/state", null, null);
    JSONObject medicine = state.getJSONArray("products").getJSONObject(0);
    assertTrue(medicine.has("hsn_code"));
    assertTrue(medicine.getJSONArray("batches").length() > 0);
    JSONArray items = new JSONArray().put(obj("product_id", "med01", "quantity", 1));
    JSONObject quote =
        retailer.call("POST", "/api/quote", obj("items", items, "supply_state_code", "29"), null);
    assertEquals(quote.getLong("tax"), quote.getLong("cgst") + quote.getLong("sgst"));
    String key = UUID.randomUUID().toString();
    JSONObject body =
        obj(
            "items",
            items,
            "supply_state_code",
            "29",
            "address",
            "Android QA address Bengaluru",
            "payment_method",
            "credit",
            "expected_total",
            quote.getLong("total"));
    JSONObject order = retailer.call("POST", "/api/orders", body, key);
    assertEquals(
        order.getString("id"), retailer.call("POST", "/api/orders", body, key).getString("id"));
    assertTrue(
        order
            .getJSONArray("lines")
            .getJSONObject(0)
            .getJSONArray("batches")
            .getJSONObject(0)
            .has("expiry_date"));
    String path = "/api/orders/" + order.getString("id");
    distributor.call("POST", path, obj("status", "confirmed"), null);
    distributor.call("POST", path, obj("status", "packed"), null);
    distributor.call(
        "POST", path, obj("status", "out_for_delivery", "driver_id", "delivery"), null);
    delivery.call(
        "POST",
        "/api/tracking",
        obj("order_id", order.getString("id"), "latitude", 12.9716, "longitude", 77.5946),
        null);
    delivery.call("POST", path, obj("status", "delivered"), null);
    String payKey = UUID.randomUUID().toString();
    JSONObject payment =
        obj(
            "order_id",
            order.getString("id"),
            "amount",
            order.getLong("total"),
            "reference",
            "ANDROID-QA");
    JSONObject p = delivery.call("POST", "/api/payments", payment, payKey);
    assertEquals(
        p.getString("id"), delivery.call("POST", "/api/payments", payment, payKey).getString("id"));
  }

  private void descendants(View v, List<View> out) {
    out.add(v);
    if (v instanceof ViewGroup) {
      ViewGroup g = (ViewGroup) v;
      for (int i = 0; i < g.getChildCount(); i++) descendants(g.getChildAt(i), out);
    }
  }

  private List<View> views() {
    List<View> result = new ArrayList<>();
    descendants(getActivity().getWindow().getDecorView(), result);
    return result;
  }

  private boolean hasText(String text) {
    for (View v : views())
      if (v instanceof TextView && ((TextView) v).getText().toString().contains(text)) return true;
    return false;
  }

  private void awaitText(String text) throws Exception {
    for (int i = 0; i < 100; i++) {
      final boolean[] found = {false};
      getInstrumentation().runOnMainSync(() -> found[0] = hasText(text));
      if (found[0]) return;
      Thread.sleep(100);
    }
    fail("Native screen missing: " + text);
  }

  private void signInNative(int port) throws Exception {
    getActivity();
    getInstrumentation().waitForIdleSync();
    getInstrumentation()
        .runOnMainSync(
            () -> {
              List<EditText> fields = new ArrayList<>();
              for (View v : views()) if (v instanceof EditText) fields.add((EditText) v);
              assertEquals(3, fields.size());
              fields.get(0).setText("http://10.0.2.2:" + port);
              fields.get(1).setText(BuildConfig.ROLE + "@supplylink.local");
              fields.get(2).setText("Demo@123");
              for (View v : views())
                if (v instanceof Button && ((Button) v).getText().toString().equals("Sign in")) {
                  v.performClick();
                  break;
                }
            });
  }

  public void testNativeActiveLoginAndNavigation() throws Exception {
    signInNative(activePort());
    awaitText("Hello,");
    getInstrumentation()
        .runOnMainSync(
            () -> {
              String tab = BuildConfig.ROLE.equals("retailer") ? "Medicines" : "Deliveries";
              for (View v : views())
                if (v instanceof TextView && ((TextView) v).getText().toString().equals(tab)) {
                  v.performClick();
                  break;
                }
            });
    awaitText(BuildConfig.ROLE.equals("retailer") ? "SEARCH MEDICINES" : "Refresh");
  }

  public void testNativeLicenceLockHasNoBusinessNavigation() throws Exception {
    signInNative(18002);
    awaitText("Workspace unavailable");
    getInstrumentation()
        .runOnMainSync(
            () -> {
              assertFalse(hasText("Medicines"));
              assertFalse(hasText("Basket"));
              assertFalse(hasText("Deliveries"));
              assertTrue(hasText("Sign out"));
            });
  }

  private void clickText(String text) throws Exception {
    getInstrumentation()
        .runOnMainSync(
            () -> {
              for (View v : views())
                if (v instanceof TextView && ((TextView) v).getText().toString().equals(text)) {
                  v.performClick();
                  return;
                }
              fail("Missing control: " + text);
            });
  }

  private void capture(String name) throws Exception {
    getInstrumentation().waitForIdleSync();
    Thread.sleep(350);
    android.graphics.Bitmap image = getInstrumentation().getUiAutomation().takeScreenshot();
    if (image == null) throw new AssertionError("Screenshot unavailable");
    try (java.io.FileOutputStream out =
        new java.io.FileOutputStream(
            new java.io.File(getActivity().getFilesDir(), name + ".png"))) {
      image.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, out);
    } finally {
      image.recycle();
    }
  }

  public void testNativeScreensAndCheckout() throws Exception {
    signInNative(activePort());
    awaitText("Hello,");
    capture("home");
    if (BuildConfig.ROLE.equals("retailer")) {
      clickText("Browse medicines");
      awaitText("SEARCH MEDICINES");
      capture("medicines");
      clickText("Batch details");
      awaitText("Medicine details");
      capture("batches");
      clickText("Back to medicines");
      clickText("Add to basket");
      clickText("Basket");
      clickText("Review server quote");
      awaitText("Review your order");
      capture("quote");
      getInstrumentation()
          .runOnMainSync(
              () -> {
                for (View v : views())
                  if (v instanceof Button
                      && ((Button) v).getText().toString().startsWith("Place order ·")) {
                    v.performClick();
                    return;
                  }
                fail("Place order button missing");
              });
      awaitText("Refresh");
      clickText("Basket");
      awaitText("Your basket is empty");
    } else {
      clickText("View assigned deliveries");
      awaitText("Refresh");
      capture("deliveries");
    }
  }

  public void testNativeExpiryTimerLocksExistingSession() throws Exception {
    signInNative(activePort());
    awaitText("Hello,");
    final JSONObject shortLicence =
        obj(
            "usable",
            true,
            "status",
            "active",
            "server_time",
            java.time.Instant.now().toString(),
            "expires_at",
            java.time.Instant.now().plusMillis(500).toString());
    getInstrumentation()
        .runOnMainSync(
            () -> {
              try {
                java.lang.reflect.Method method =
                    MainActivity.class.getDeclaredMethod("setLicence", JSONObject.class);
                method.setAccessible(true);
                method.invoke(getActivity(), shortLicence);
              } catch (Exception e) {
                throw new AssertionError(e);
              }
            });
    awaitText("Workspace unavailable");
    capture("licence-lock");
    getInstrumentation().runOnMainSync(() -> assertFalse(hasText("Basket")));
  }

  public void testOnlyDeliveryBuildRequestsLocationPermission() throws Exception {
    String[] permissions =
        getActivity()
            .getPackageManager()
            .getPackageInfo(
                getActivity().getPackageName(), android.content.pm.PackageManager.GET_PERMISSIONS)
            .requestedPermissions;
    boolean location = false;
    for (String p : permissions)
      if (p.equals("android.permission.ACCESS_FINE_LOCATION")) location = true;
    assertEquals(BuildConfig.ROLE.equals("delivery"), location);
  }

  public void testPasswordIsMaskedOnLoginAndRegistration() throws Exception {
    getActivity();
    getInstrumentation().waitForIdleSync();
    getInstrumentation()
        .runOnMainSync(
            () -> {
              List<EditText> fields = new ArrayList<>();
              for (View v : views()) if (v instanceof EditText) fields.add((EditText) v);
              assertTrue(
                  fields.get(2).getTransformationMethod()
                      instanceof android.text.method.PasswordTransformationMethod);
            });
    clickText("Request an account");
    awaitText("PASSWORD (10+ CHARACTERS)");
    getInstrumentation()
        .runOnMainSync(
            () -> {
              List<EditText> fields = new ArrayList<>();
              for (View v : views()) if (v instanceof EditText) fields.add((EditText) v);
              assertTrue(
                  fields.get(3).getTransformationMethod()
                      instanceof android.text.method.PasswordTransformationMethod);
            });
  }
}
