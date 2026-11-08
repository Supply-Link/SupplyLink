package com.supplylink.mobile;

import android.app.*;
import android.content.*;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.*;
import android.view.*;
import android.widget.*;
import java.util.*;
import java.util.concurrent.*;
import org.json.*;

public final class MainActivity extends Activity {
  private static final int GREEN = 0xff153e35,
      INK = 0xff203d35,
      MUTED = 0xff78877f,
      BG = 0xfff4f7f4;
  private final ExecutorService worker = Executors.newSingleThreadExecutor();
  private final Handler main = new Handler(Looper.getMainLooper());
  private Api api;
  private JSONObject user = new JSONObject(), state = new JSONObject(), licence = new JSONObject();
  private boolean signedIn = false, busy = false, destroyed = false;
  private long licenceDeadline = Long.MAX_VALUE;
  private final Runnable expiryAlarm =
      () -> {
        if (signedIn && !usable()) {
          clearBusiness();
          locked();
        }
      };
  private LinearLayout root, content, nav;
  private TextView activityLabel;
  private final Map<String, Integer> cart = new LinkedHashMap<>();
  private String screen = "Home", selectedOrder = "", search = "";
  private JSONObject lastQuote;
  private String checkoutKey = UUID.randomUUID().toString();
  private final Map<String, String> collectionKeys = new HashMap<>();
  private LocationCapture locationCapture;
  private final Runnable licencePoll =
      new Runnable() {
        public void run() {
          if (signedIn && !busy)
            request(
                "GET",
                "/api/license",
                null,
                null,
                r -> {
                  setLicence(r);
                  if (!usable()) {
                    clearBusiness();
                    locked();
                  }
                },
                false);
          main.postDelayed(this, 15000);
        }
      };

  private interface Done {
    void accept(JSONObject result) throws Exception;
  }

  private boolean retailer() {
    return BuildConfig.ROLE.equals("retailer");
  }

  private void setLicence(JSONObject value) {
    licence = value;
    main.removeCallbacks(expiryAlarm);
    licenceDeadline = Long.MAX_VALUE;
    if (value.optBoolean("usable", false))
      try {
        long remaining =
            java.time.Duration.between(
                    java.time.Instant.parse(value.getString("server_time")),
                    java.time.OffsetDateTime.parse(value.getString("expires_at")).toInstant())
                .toMillis();
        licenceDeadline = SystemClock.elapsedRealtime() + Math.max(0, remaining);
        main.postDelayed(expiryAlarm, Math.max(1, remaining));
      } catch (Exception e) {
        licenceDeadline = 0;
      }
  }

  private boolean usable() {
    return licence.optBoolean("usable", false) && SystemClock.elapsedRealtime() < licenceDeadline;
  }

  private int dp(float v) {
    return (int) (getResources().getDisplayMetrics().density * v + .5f);
  }

  private JSONObject object(Object... pairs) {
    JSONObject o = new JSONObject();
    try {
      for (int i = 0; i < pairs.length; i += 2) o.put((String) pairs[i], pairs[i + 1]);
    } catch (JSONException e) {
      throw new IllegalArgumentException(e);
    }
    return o;
  }

  private JSONArray array(JSONObject source, String key) {
    JSONArray a = source.optJSONArray(key);
    return a == null ? new JSONArray() : a;
  }

  private JSONObject find(String collection, String id) {
    JSONArray a = array(state, collection);
    for (int i = 0; i < a.length(); i++) {
      JSONObject o = a.optJSONObject(i);
      if (o != null && o.optString("id").equals(id)) return o;
    }
    return new JSONObject();
  }

  private String money(JSONObject o, String key) {
    return Rules.money(o.optLong(key));
  }

  private String date(String value) {
    try {
      return java.time.OffsetDateTime.parse(value)
          .atZoneSameInstant(java.time.ZoneId.of("Asia/Kolkata"))
          .format(
              java.time.format.DateTimeFormatter.ofPattern(
                  "d MMM yyyy, h:mm a 'IST'", Locale.ENGLISH));
    } catch (Exception e) {
      return value;
    }
  }

  private void clearBusiness() {
    state = new JSONObject();
    cart.clear();
    lastQuote = null;
    selectedOrder = "";
    collectionKeys.clear();
  }

  @Override
  public void onCreate(Bundle saved) {
    super.onCreate(saved);
    locationCapture = new LocationCapture(this);
    if (!BuildConfig.DEBUG)
      getWindow()
          .setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
    api =
        new Api(
            getPreferences(MODE_PRIVATE)
                .getString("server", BuildConfig.DEBUG ? "http://10.0.2.2:8000" : ""));
    login();
  }

  @Override
  protected void onResume() {
    super.onResume();
    main.removeCallbacks(licencePoll);
    main.post(licencePoll);
    if (signedIn && !usable()) {
      clearBusiness();
      locked();
    }
  }

  @Override
  protected void onPause() {
    super.onPause();
    main.removeCallbacks(licencePoll);
    stopGps();
  }

  @Override
  protected void onDestroy() {
    destroyed = true;
    main.removeCallbacksAndMessages(null);
    stopGps();
    worker.shutdownNow();
    super.onDestroy();
  }

  @Override
  public void onBackPressed() {
    if (signedIn && usable()) {
      selectedOrder = "";
      screen = "Home";
      render();
    } else if (!signedIn) login();
    else super.onBackPressed();
  }

  private void request(
      String method, String path, JSONObject body, String key, Done done, boolean visible) {
    if (signedIn && !usable() && !path.equals("/api/logout") && !path.equals("/api/license")) {
      clearBusiness();
      locked();
      return;
    }
    if (busy) {
      if (visible) toast("Please wait for the current request.");
      return;
    }
    busy = true;
    if (visible && activityLabel != null) activityLabel.setText("Connecting to your server…");
    worker.execute(
        () -> {
          try {
            JSONObject result = api.call(method, path, body, key);
            main.post(
                () -> {
                  if (destroyed) return;
                  busy = false;
                  if (activityLabel != null) activityLabel.setText("");
                  try {
                    done.accept(result);
                  } catch (Exception e) {
                    showError(e.getMessage());
                  }
                });
          } catch (Exception error) {
            main.post(
                () -> {
                  if (destroyed) return;
                  busy = false;
                  if (activityLabel != null) activityLabel.setText("");
                  if (error instanceof Api.Failure) {
                    Api.Failure f = (Api.Failure) error;
                    if (f.status == 423) {
                      licence = f.payload.optJSONObject("license");
                      if (licence == null) licence = new JSONObject();
                      clearBusiness();
                      if (signedIn) locked();
                      else {
                        login();
                        showError(f.getMessage());
                      }
                      return;
                    }
                    if (f.status == 401 && signedIn) {
                      signedIn = false;
                      api.clear();
                      clearBusiness();
                      login();
                    }
                  }
                  if (visible)
                    showError(
                        error.getMessage() == null
                            ? "Connection failed. Check the server URL and network."
                            : error.getMessage());
                });
          }
        });
  }

  private void toast(String s) {
    Toast.makeText(this, s, Toast.LENGTH_LONG).show();
  }

  private void showError(String s) {
    new AlertDialog.Builder(this)
        .setTitle("Unable to complete")
        .setMessage(s)
        .setPositiveButton("OK", null)
        .show();
  }

  private GradientDrawable shape(int color, int stroke) {
    GradientDrawable d = new GradientDrawable();
    d.setColor(color);
    d.setCornerRadius(dp(15));
    if (stroke != 0) d.setStroke(dp(1), stroke);
    return d;
  }

  private LinearLayout column() {
    LinearLayout l = new LinearLayout(this);
    l.setOrientation(LinearLayout.VERTICAL);
    return l;
  }

  private TextView text(LinearLayout parent, String value, int size, int color, boolean bold) {
    TextView t = new TextView(this);
    t.setText(value);
    t.setTextSize(size);
    t.setTextColor(color);
    if (bold) t.setTypeface(null, Typeface.BOLD);
    t.setPadding(0, dp(4), 0, dp(5));
    parent.addView(t);
    return t;
  }

  private Button button(LinearLayout parent, String title, Runnable action) {
    Button b = new Button(this);
    b.setText(title);
    b.setAllCaps(false);
    b.setTextColor(Color.WHITE);
    b.setTextSize(15);
    b.setBackground(shape(GREEN, 0));
    LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, dp(48));
    p.setMargins(0, dp(9), 0, dp(5));
    parent.addView(b, p);
    b.setOnClickListener(v -> action.run());
    return b;
  }

  private EditText input(LinearLayout parent, String label, String value, int type) {
    text(parent, label, 12, MUTED, true);
    EditText e = new EditText(this);
    e.setText(value);
    e.setTextSize(16);
    e.setTextColor(INK);
    e.setInputType(type);
    e.setSingleLine(
        type
            != android.text.InputType.TYPE_CLASS_TEXT
                + android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE);
    if ((type & android.text.InputType.TYPE_MASK_VARIATION)
        == android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD)
      e.setTransformationMethod(android.text.method.PasswordTransformationMethod.getInstance());
    e.setPadding(dp(12), dp(10), dp(12), dp(10));
    e.setBackground(shape(Color.WHITE, 0xffdce4de));
    parent.addView(e, new LinearLayout.LayoutParams(-1, -2));
    return e;
  }

  private LinearLayout card(LinearLayout parent) {
    LinearLayout c = column();
    c.setPadding(dp(17), dp(14), dp(17), dp(16));
    c.setBackground(shape(Color.WHITE, 0xffdfe7df));
    LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, -2);
    p.setMargins(0, dp(10), 0, dp(3));
    parent.addView(c, p);
    return c;
  }

  private void shell(String title, String subtitle, boolean tabs) {
    root = column();
    root.setBackgroundColor(BG);
    setContentView(root);
    root.setOnApplyWindowInsetsListener(
        (v, insets) -> {
          v.setPadding(
              insets.getSystemWindowInsetLeft(),
              insets.getSystemWindowInsetTop(),
              insets.getSystemWindowInsetRight(),
              insets.getSystemWindowInsetBottom());
          return insets;
        });
    LinearLayout header = column();
    header.setPadding(dp(22), dp(15), dp(22), dp(16));
    header.setBackgroundColor(GREEN);
    text(
        header,
        "✚  SUPPLYLINK  /  " + BuildConfig.ROLE.toUpperCase(Locale.ROOT),
        12,
        0xffb6d8c0,
        true);
    text(header, title, 27, Color.WHITE, true);
    if (!subtitle.isEmpty()) text(header, subtitle, 13, 0xffd7e8dd, false);
    root.addView(header);
    ScrollView scroll = new ScrollView(this);
    scroll.setFillViewport(true);
    content = column();
    content.setPadding(dp(20), dp(12), dp(20), dp(24));
    scroll.addView(content);
    root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
    activityLabel = text(root, "", 12, MUTED, false);
    activityLabel.setPadding(dp(20), 0, dp(20), 0);
    if (tabs) {
      nav = new LinearLayout(this);
      nav.setBackgroundColor(Color.WHITE);
      String[] names =
          retailer()
              ? new String[] {"Home", "Medicines", "Orders", "Basket", "Account"}
              : new String[] {"Home", "Deliveries", "Alerts", "Account"};
      for (String n : names) {
        TextView t = new TextView(this);
        t.setText(n);
        t.setGravity(Gravity.CENTER);
        t.setTextSize(12);
        t.setTextColor(screen.equals(n) ? GREEN : MUTED);
        t.setTypeface(null, screen.equals(n) ? Typeface.BOLD : Typeface.NORMAL);
        nav.addView(t, new LinearLayout.LayoutParams(0, dp(58), 1));
        t.setOnClickListener(
            v -> {
              if (busy) return;
              selectedOrder = "";
              screen = n;
              render();
            });
      }
      root.addView(nav);
    }
  }

  private void login() {
    signedIn = false;
    shell(
        "Welcome back",
        retailer() ? "Your pharmacy, connected." : "Every delivery, accounted for.",
        false);
    LinearLayout c = card(content);
    text(c, "Sign in to your workspace", 20, INK, true);
    text(c, "Use the account approved by your administrator.", 14, MUTED, false);
    EditText server =
        input(
            c,
            "SERVER URL",
            api.base,
            android.text.InputType.TYPE_CLASS_TEXT
                | android.text.InputType.TYPE_TEXT_VARIATION_URI);
    EditText email =
        input(
            c,
            "EMAIL",
            "",
            android.text.InputType.TYPE_CLASS_TEXT
                | android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
    EditText password =
        input(
            c,
            "PASSWORD",
            "",
            android.text.InputType.TYPE_CLASS_TEXT
                | android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD);
    button(
        c,
        "Sign in",
        () -> {
          try {
            api.base = Rules.server(server.getText().toString(), BuildConfig.DEBUG);
            api.clear();
            getPreferences(MODE_PRIVATE).edit().putString("server", api.base).apply();
            request(
                "POST",
                "/api/login",
                object(
                    "email",
                    email.getText().toString().trim(),
                    "password",
                    password.getText().toString()),
                null,
                r -> {
                  JSONObject u = r.getJSONObject("user");
                  if (!u.optString("role").equals(BuildConfig.ROLE)) {
                    request(
                        "POST",
                        "/api/logout",
                        object(),
                        null,
                        x -> {
                          api.clear();
                          showError(
                              "Use a "
                                  + BuildConfig.ROLE
                                  + " account in this app. Administrators and distributors use the"
                                  + " web portal.");
                        },
                        true);
                    return;
                  }
                  user = u;
                  setLicence(r.getJSONObject("license"));
                  signedIn = true;
                  screen = "Home";
                  if (usable()) refresh();
                  else locked();
                },
                true);
          } catch (Exception e) {
            showError(e.getMessage());
          }
        });
    button(
        c,
        "Request an account",
        () -> {
          try {
            api.base = Rules.server(server.getText().toString(), BuildConfig.DEBUG);
            getPreferences(MODE_PRIVATE).edit().putString("server", api.base).apply();
            registration();
          } catch (Exception e) {
            showError(e.getMessage());
          }
        });
    text(
        content,
        "Your session stays in memory. Passwords are never saved on this device.",
        12,
        MUTED,
        false);
  }

  private void registration() {
    shell("Join SupplyLink", "Administrator approval is required", false);
    LinearLayout c = card(content);
    EditText name = input(c, "FULL NAME", "", 1),
        business = input(c, retailer() ? "PHARMACY / BUSINESS" : "DELIVERY TEAM", "", 1),
        email = input(c, "EMAIL", "", 33),
        pass = input(c, "PASSWORD (10+ CHARACTERS)", "", 129),
        address = input(c, "ADDRESS", "", 1),
        code = input(c, "GST STATE CODE", "29", 2),
        gst = input(c, "GSTIN (OPTIONAL)", "", 1),
        drug = input(c, "DRUG LICENCE (OPTIONAL)", "", 1);
    button(
        c,
        "Submit registration",
        () ->
            request(
                "POST",
                "/api/register",
                object(
                    "name",
                    name.getText().toString(),
                    "business",
                    business.getText().toString(),
                    "email",
                    email.getText().toString(),
                    "password",
                    pass.getText().toString(),
                    "address",
                    address.getText().toString(),
                    "state_code",
                    code.getText().toString(),
                    "gstin",
                    gst.getText().toString(),
                    "drug_license",
                    drug.getText().toString(),
                    "role",
                    BuildConfig.ROLE),
                null,
                r -> {
                  login();
                  new AlertDialog.Builder(this)
                      .setTitle("Registration submitted")
                      .setMessage("Your administrator must approve your account before sign-in.")
                      .setPositiveButton("OK", null)
                      .show();
                },
                true));
    button(content, "Back to sign in", this::login);
  }

  private void locked() {
    clearBusiness();
    stopGps();
    shell("Licence required", "Signed in as " + user.optString("name"), false);
    LinearLayout c = card(content);
    text(c, "◷  Workspace unavailable", 22, INK, true);
    text(
        c,
        (licence.optString("status").equals("expired")
                || SystemClock.elapsedRealtime() >= licenceDeadline)
            ? "The software licence has expired."
            : "This installation has no active software licence.",
        16,
        INK,
        false);
    text(
        c,
        "Only sign-in and sign-out are available. Contact your administrator to activate the"
            + " installation.",
        15,
        MUTED,
        false);
    if (!licence.isNull("expires_on") && licence.has("expires_on"))
      text(
          c,
          "Valid through " + licence.optString("expires_on") + " (India time)",
          14,
          MUTED,
          false);
    button(
        c,
        "Check activation",
        () ->
            request(
                "GET",
                "/api/license",
                null,
                null,
                r -> {
                  setLicence(r);
                  if (usable()) refresh();
                  else locked();
                },
                true));
    button(c, "Sign out", this::logout);
  }

  private void logout() {
    request(
        "POST",
        "/api/logout",
        object(),
        null,
        r -> {
          api.clear();
          signedIn = false;
          user = new JSONObject();
          clearBusiness();
          login();
        },
        true);
  }

  private void refresh() {
    request(
        "GET",
        "/api/state",
        null,
        null,
        r -> {
          state = r;
          user = r.getJSONObject("user");
          render();
        },
        true);
  }

  private void render() {
    if (!signedIn) {
      login();
      return;
    }
    if (!usable()) {
      locked();
      return;
    }
    if (!selectedOrder.isEmpty()) {
      orderDetail();
      return;
    }
    shell(screen, user.optString("business", user.optString("name")), true);
    switch (screen) {
      case "Medicines":
        catalog();
        break;
      case "Orders":
      case "Deliveries":
        orders();
        break;
      case "Basket":
        basket();
        break;
      case "Account":
        account();
        break;
      case "Alerts":
        alerts();
        break;
      default:
        home();
    }
  }

  private void home() {
    text(content, "Hello, " + user.optString("name").split(" ")[0], 24, INK, true);
    text(
        content,
        retailer() ? "Keep your shelves ready for care." : "Your delivery desk for today.",
        15,
        MUTED,
        false);
    JSONArray orders = array(state, "orders");
    int active = 0;
    for (int i = 0; i < orders.length(); i++) {
      String s = orders.optJSONObject(i).optString("status");
      if (!s.equals("delivered") && !s.equals("cancelled")) active++;
    }
    LinearLayout metrics = card(content);
    text(
        metrics,
        "◫  " + active + " active " + (retailer() ? "orders" : "deliveries"),
        23,
        INK,
        true);
    text(metrics, orders.length() + " total · Updated from your server", 13, MUTED, false);
    if (retailer()) {
      LinearLayout credit = card(content);
      text(credit, "Available trade credit", 14, MUTED, true);
      text(
          credit,
          Rules.money(Math.max(0, user.optLong("credit_limit") - user.optLong("credit_used"))),
          25,
          INK,
          true);
      text(
          credit,
          "Limit " + money(user, "credit_limit") + " · Used " + money(user, "credit_used"),
          13,
          MUTED,
          false);
      button(
          content,
          "Browse medicines",
          () -> {
            screen = "Medicines";
            render();
          });
    } else
      button(
          content,
          "View assigned deliveries",
          () -> {
            screen = "Deliveries";
            render();
          });
    button(content, "Refresh workspace", this::refresh);
    button(
        content,
        "Notifications",
        () -> {
          screen = "Alerts";
          render();
        });
    text(content, "RECENT ORDERS", 12, MUTED, true);
    if (orders.length() == 0) empty("No orders yet.");
    for (int i = 0; i < Math.min(3, orders.length()); i++) orderCard(orders.optJSONObject(i));
  }

  private void empty(String message) {
    text(card(content), message, 16, MUTED, false);
  }

  private void catalog() {
    EditText q = input(content, "SEARCH MEDICINES", search, 1);
    button(
        content,
        "Search",
        () -> {
          search = q.getText().toString().trim();
          render();
        });
    text(content, "Batch availability and GST are supplied by your distributor.", 13, MUTED, false);
    JSONArray products = array(state, "products");
    int count = 0;
    for (int i = 0; i < products.length(); i++) {
      JSONObject p = products.optJSONObject(i);
      String terms =
          (p.optString("name")
                  + " "
                  + p.optString("generic_name")
                  + " "
                  + p.optString("category")
                  + " "
                  + p.optString("manufacturer"))
              .toLowerCase(Locale.ROOT);
      if (!terms.contains(search.toLowerCase(Locale.ROOT))) continue;
      count++;
      LinearLayout c = card(content);
      text(c, "✚  " + p.optString("name"), 19, INK, true);
      text(c, p.optString("manufacturer") + " · " + p.optString("unit"), 13, MUTED, false);
      text(
          c,
          money(p, "price") + " excl. GST  ·  " + p.optLong("stock") + " available",
          16,
          GREEN,
          true);
      text(
          c,
          "HSN " + p.optString("hsn_code") + " · GST " + (p.optInt("gst_rate_bps") / 100.0) + "%",
          12,
          MUTED,
          false);
      button(c, "Batch details", () -> product(p));
      if (p.optLong("stock") > 0) button(c, "Add to basket", () -> addToCart(p));
    }
    if (count == 0) empty("No medicines match your search.");
  }

  private void product(JSONObject p) {
    shell("Medicine details", p.optString("name"), false);
    LinearLayout c = card(content);
    text(c, p.optString("name"), 23, INK, true);
    text(c, p.optString("generic_name") + " · " + p.optString("strength"), 16, INK, false);
    text(
        c,
        p.optString("manufacturer")
            + "\n"
            + p.optString("unit")
            + "\n"
            + p.optString("storage_conditions"),
        14,
        MUTED,
        false);
    text(
        c,
        "Price "
            + money(p, "price")
            + " excl. GST\nHSN "
            + p.optString("hsn_code")
            + " · GST "
            + p.optInt("gst_rate_bps") / 100.0
            + "%",
        15,
        INK,
        false);
    JSONArray batches = array(p, "batches");
    for (int i = 0; i < batches.length(); i++) {
      JSONObject b = batches.optJSONObject(i);
      LinearLayout bc = card(content);
      text(bc, "▣  Batch " + b.optString("batch_number"), 17, INK, true);
      text(
          bc,
          "Expiry "
              + b.optString("expiry_date")
              + " · "
              + b.optString("status")
              + "\nManufactured "
              + b.optString("manufacturing_date")
              + "\nMRP "
              + money(b, "mrp")
              + " (incl. GST) · Stock "
              + b.optLong("stock"),
          14,
          MUTED,
          false);
    }
    if (p.optLong("stock") > 0) button(content, "Add to basket", () -> addToCart(p));
    button(content, "Back to medicines", this::render);
  }

  private void addToCart(JSONObject p) {
    String id = p.optString("id");
    int n = cart.getOrDefault(id, 0) + 1;
    if (n > p.optInt("stock")) {
      toast("Available stock reached.");
      return;
    }
    cart.put(id, n);
    lastQuote = null;
    checkoutKey = UUID.randomUUID().toString();
    toast("Added to basket · " + n + " × " + p.optString("name"));
  }

  private JSONArray items() {
    JSONArray a = new JSONArray();
    for (Map.Entry<String, Integer> e : cart.entrySet())
      a.put(object("product_id", e.getKey(), "quantity", e.getValue()));
    return a;
  }

  private void basket() {
    if (cart.isEmpty()) {
      empty("Your basket is empty. Browse medicines to start an order.");
      return;
    }
    for (String id : new ArrayList<>(cart.keySet())) {
      JSONObject p = find("products", id);
      LinearLayout c = card(content);
      text(c, p.optString("name", id), 18, INK, true);
      text(c, cart.get(id) + " × " + money(p, "price") + " excl. GST", 15, MUTED, false);
      EditText quantity = input(c, "QUANTITY", String.valueOf(cart.get(id)), 2);
      button(
          c,
          "Update quantity",
          () -> {
            try {
              int n = Integer.parseInt(quantity.getText().toString());
              if (n < 1 || n > p.optInt("stock"))
                throw new IllegalArgumentException(
                    "Choose between 1 and " + p.optInt("stock") + " units.");
              cart.put(id, n);
              lastQuote = null;
              checkoutKey = UUID.randomUUID().toString();
              render();
            } catch (Exception e) {
              showError(e.getMessage());
            }
          });
      button(
          c,
          "Remove",
          () -> {
            cart.remove(id);
            lastQuote = null;
            checkoutKey = UUID.randomUUID().toString();
            render();
          });
    }
    LinearLayout checkout = card(content);
    text(checkout, "Delivery & billing", 20, INK, true);
    EditText address = input(checkout, "DELIVERY ADDRESS", user.optString("address"), 1),
        code =
            input(
                checkout,
                "PLACE OF SUPPLY · GST STATE CODE",
                user.optString("state_code", "29"),
                2);
    text(checkout, "Payment method", 13, MUTED, true);
    Spinner method = new Spinner(this);
    method.setAdapter(
        new ArrayAdapter<>(
            this,
            android.R.layout.simple_spinner_dropdown_item,
            new String[] {"Cash on delivery", "Trade credit"}));
    checkout.addView(method);
    button(
        checkout,
        "Review server quote",
        () ->
            request(
                "POST",
                "/api/quote",
                object("items", items(), "supply_state_code", code.getText().toString().trim()),
                null,
                r -> {
                  lastQuote = r;
                  reviewQuote(
                      r,
                      address.getText().toString(),
                      code.getText().toString().trim(),
                      method.getSelectedItemPosition() == 0 ? "cod" : "credit");
                },
                true));
    text(
        checkout,
        "Final batches are allocated by earliest expiry when the order is placed. Review the server"
            + " quote before confirming.",
        13,
        MUTED,
        false);
  }

  private void totals(LinearLayout c, JSONObject q) {
    String[] fields = {
      "subtotal", "discount", "taxable", "cgst", "sgst", "utgst", "igst", "tax", "total"
    };
    for (String f : fields)
      if (q.has(f) && (q.optLong(f) != 0 || f.equals("total")))
        text(
            c,
            f.toUpperCase(Locale.ROOT) + "    " + money(q, f),
            f.equals("total") ? 22 : 14,
            f.equals("total") ? GREEN : INK,
            f.equals("total"));
  }

  private void reviewQuote(JSONObject q, String address, String code, String method) {
    shell("Review your order", "Server-calculated prices and GST", false);
    LinearLayout c = card(content);
    totals(c, q);
    text(
        c,
        "Place of supply: "
            + code
            + "\n"
            + address
            + "\nPayment: "
            + (method.equals("cod") ? "Cash on delivery" : "Trade credit"),
        15,
        MUTED,
        false);
    button(
        c,
        "Place order · " + money(q, "total"),
        () ->
            request(
                "POST",
                "/api/orders",
                object(
                    "items",
                    items(),
                    "address",
                    address,
                    "supply_state_code",
                    code,
                    "payment_method",
                    method,
                    "expected_total",
                    q.optLong("total")),
                checkoutKey,
                r -> {
                  cart.clear();
                  lastQuote = null;
                  checkoutKey = UUID.randomUUID().toString();
                  screen = "Orders";
                  selectedOrder = "";
                  toast("Order placed successfully.");
                  refresh();
                },
                true));
    button(content, "Back to basket", this::render);
  }

  private void orders() {
    button(content, "Refresh", this::refresh);
    JSONArray a = array(state, "orders");
    if (a.length() == 0)
      empty(
          retailer()
              ? "Your orders will appear here."
              : "No deliveries have been assigned to you.");
    for (int i = 0; i < a.length(); i++) orderCard(a.optJSONObject(i));
  }

  private void orderCard(JSONObject o) {
    LinearLayout c = card(content);
    text(c, o.optString("number") + "    " + money(o, "total"), 19, INK, true);
    text(c, Rules.stage(o.optString("status")), 15, GREEN, true);
    text(
        c, o.optString("retailer_name") + "\n" + date(o.optString("created_at")), 13, MUTED, false);
    button(
        c,
        "View details",
        () -> {
          selectedOrder = o.optString("id");
          orderDetail();
        });
  }

  private void orderDetail() {
    JSONObject o = find("orders", selectedOrder);
    if (!o.has("id")) {
      selectedOrder = "";
      render();
      return;
    }
    shell(o.optString("number"), Rules.stage(o.optString("status")), false);
    LinearLayout summary = card(content);
    text(summary, o.optString("retailer_name"), 20, INK, true);
    text(summary, o.optString("address"), 15, INK, false);
    text(
        summary,
        "Payment: " + o.optString("payment_method") + " · " + o.optString("payment_status"),
        14,
        MUTED,
        false);
    text(
        summary,
        "Place of supply: "
            + o.optString("supply_state_code", "—")
            + " · "
            + o.optString("tax_type", ""),
        13,
        MUTED,
        false);
    JSONArray lines = array(o, "lines");
    for (int i = 0; i < lines.length(); i++) {
      JSONObject line = lines.optJSONObject(i);
      LinearLayout c = card(content);
      text(c, line.optString("name"), 17, INK, true);
      text(
          c,
          line.optInt("quantity")
              + " × "
              + money(line, "unit_price")
              + " · "
              + line.optString("unit"),
          14,
          MUTED,
          false);
      if (line.has("gst_rate_bps"))
        text(
            c,
            "HSN "
                + line.optString("hsn_code")
                + " · GST "
                + line.optInt("gst_rate_bps") / 100.0
                + "% · Tax "
                + money(line, "tax"),
            13,
            MUTED,
            false);
      JSONArray batches = array(line, "batches");
      for (int b = 0; b < batches.length(); b++) {
        JSONObject batch = batches.optJSONObject(b);
        text(
            c,
            "▣  "
                + batch.optString("batch_number")
                + " · Exp "
                + batch.optString("expiry_date")
                + " · Qty "
                + batch.optInt("quantity")
                + "\nMRP "
                + money(batch, "mrp")
                + " incl. GST",
            13,
            INK,
            false);
      }
      if (batches.length() == 0)
        text(c, "Batch details are unavailable for this legacy order.", 12, MUTED, false);
    }
    totals(card(content), o);
    LinearLayout timeline = card(content);
    text(timeline, "Order timeline", 20, INK, true);
    JSONArray history = array(o, "history");
    for (int i = 0; i < history.length(); i++) {
      JSONObject h = history.optJSONObject(i);
      text(timeline, Rules.stage(h.optString("status")), 18, GREEN, true);
      text(timeline, date(h.optString("at")) + " · " + h.optString("by"), 13, MUTED, false);
      if (i < history.length() - 1) text(timeline, "│", 18, 0xffb9caba, false);
    }
    JSONArray points = array(o, "tracking");
    if (points.length() > 0) {
      JSONObject p = points.optJSONObject(points.length() - 1);
      text(
          card(content),
          "⌖  Latest shared location\n"
              + p.optDouble("latitude")
              + ", "
              + p.optDouble("longitude")
              + "\n"
              + date(p.optString("at")),
          14,
          INK,
          false);
    }
    if (retailer() && Rules.cancellable(o.optString("status"), o.optString("payment_status")))
      button(
          content,
          "Cancel order",
          () ->
              new AlertDialog.Builder(this)
                  .setTitle("Cancel " + o.optString("number") + "?")
                  .setMessage("Reserved stock and trade credit will be released.")
                  .setNegativeButton("Keep order", null)
                  .setPositiveButton(
                      "Cancel order",
                      (d, w) ->
                          request(
                              "POST",
                              "/api/orders/" + o.optString("id"),
                              object("status", "cancelled"),
                              null,
                              r -> refresh(),
                              true))
                  .show());
    if (!retailer()) {
      if (o.optString("status").equals("out_for_delivery")) {
        button(content, "⌖  Share current location", () -> gps(o.optString("id")));
        button(content, "Enter location manually", () -> manualLocation(o.optString("id")));
        button(
            content,
            "✓  Mark as delivered",
            () ->
                new AlertDialog.Builder(this)
                    .setTitle("Confirm delivery")
                    .setMessage("Has the customer received this order?")
                    .setNegativeButton("Back", null)
                    .setPositiveButton(
                        "Delivered",
                        (d, w) ->
                            request(
                                "POST",
                                "/api/orders/" + o.optString("id"),
                                object("status", "delivered"),
                                null,
                                r -> refresh(),
                                true))
                    .show());
      }
      if (o.optString("status").equals("delivered")
          && !o.optString("payment_status").equals("paid"))
        button(content, "Record collection · " + money(o, "total"), () -> collection(o));
    }
    button(content, "Refresh order", this::refresh);
    button(
        content,
        "Back",
        () -> {
          selectedOrder = "";
          render();
        });
  }

  private void collection(JSONObject order) {
    LinearLayout form = column();
    form.setPadding(dp(20), 0, dp(20), 0);
    text(
        form,
        "Record the full amount already collected. This does not charge a bank account.",
        14,
        MUTED,
        false);
    EditText reference = input(form, "RECEIPT / PAYMENT REFERENCE", "", 1);
    AlertDialog d =
        new AlertDialog.Builder(this)
            .setTitle("Collection · " + money(order, "total"))
            .setView(form)
            .setNegativeButton("Back", null)
            .setPositiveButton("Record", null)
            .create();
    d.setOnShowListener(
        x ->
            d.getButton(-1)
                .setOnClickListener(
                    v -> {
                      String ref = reference.getText().toString().trim();
                      if (ref.isEmpty()) {
                        reference.setError("Reference is required");
                        return;
                      }
                      String id = order.optString("id");
                      String key =
                          collectionKeys.computeIfAbsent(id, k -> UUID.randomUUID().toString());
                      d.dismiss();
                      request(
                          "POST",
                          "/api/payments",
                          object(
                              "order_id", id, "amount", order.optLong("total"), "reference", ref),
                          key,
                          r -> {
                            collectionKeys.remove(id);
                            toast("Collection recorded.");
                            refresh();
                          },
                          true);
                    }));
    d.show();
  }

  private void alerts() {
    button(
        content,
        "Mark all read",
        () -> request("POST", "/api/notifications/read", object(), null, r -> refresh(), true));
    JSONArray a = array(state, "notifications");
    if (a.length() == 0) empty("You are all caught up.");
    for (int i = 0; i < a.length(); i++) {
      JSONObject n = a.optJSONObject(i);
      LinearLayout c = card(content);
      text(c, (n.optBoolean("read") ? "" : "●  ") + n.optString("title"), 18, INK, true);
      text(c, n.optString("body"), 15, MUTED, false);
      text(c, date(n.optString("at")), 12, MUTED, false);
    }
  }

  private void account() {
    LinearLayout c = card(content);
    text(c, user.optString("name"), 23, INK, true);
    text(
        c,
        user.optString("email") + "\n" + user.optString("business") + "\nRole: " + BuildConfig.ROLE,
        15,
        MUTED,
        false);
    text(c, "Server: " + api.base, 12, MUTED, false);
    if (retailer()) {
      text(
          c,
          "GSTIN: "
              + user.optString("gstin", "—")
              + "\nDrug licence: "
              + user.optString("drug_license", "—")
              + "\nState: "
              + user.optString("state_code"),
          14,
          INK,
          false);
      button(c, "Edit business details", this::business);
    }
    text(
        c,
        "Software licence: "
            + licence.optString("status")
            + "\nExpiry: "
            + licence.optString("expires_on", "—"),
        13,
        MUTED,
        false);
    text(content, "Collections", 19, INK, true);
    JSONArray payments = array(state, "payments");
    if (payments.length() == 0) text(content, "No payments recorded.", 14, MUTED, false);
    for (int i = 0; i < payments.length(); i++) {
      JSONObject p = payments.optJSONObject(i);
      text(
          card(content),
          p.optString("order_number")
              + " · "
              + money(p, "amount")
              + "\nReference: "
              + p.optString("reference")
              + "\n"
              + date(p.optString("at")),
          14,
          INK,
          false);
    }
    button(content, "Refresh account", this::refresh);
    button(content, "Sign out", this::logout);
  }

  private void business() {
    shell("Business details", "Used for GST invoices", false);
    LinearLayout c = card(content);
    EditText
        legal =
            input(
                c,
                "LEGAL BUSINESS NAME",
                user.optString("legal_name", user.optString("business")),
                1),
        address = input(c, "BUSINESS ADDRESS", user.optString("address"), 1),
        code = input(c, "GST STATE CODE", user.optString("state_code"), 2),
        gst = input(c, "GSTIN", user.optString("gstin"), 1),
        drug = input(c, "DRUG LICENCE", user.optString("drug_license"), 1);
    button(
        c,
        "Save details",
        () ->
            request(
                "POST",
                "/api/business",
                object(
                    "user_id",
                    user.optString("id"),
                    "legal_name",
                    legal.getText().toString(),
                    "address",
                    address.getText().toString(),
                    "state_code",
                    code.getText().toString(),
                    "gstin",
                    gst.getText().toString(),
                    "drug_license",
                    drug.getText().toString()),
                null,
                r -> refresh(),
                true));
    button(content, "Back", this::render);
  }

  private void manualLocation(String order) {
    LinearLayout c = column();
    c.setPadding(dp(20), 0, dp(20), 0);
    EditText lat = input(c, "LATITUDE", "", 8194 | 4096),
        lon = input(c, "LONGITUDE", "", 8194 | 4096);
    AlertDialog d =
        new AlertDialog.Builder(this)
            .setTitle("Share delivery location")
            .setView(c)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Review", null)
            .create();
    d.setOnShowListener(
        x ->
            d.getButton(-1)
                .setOnClickListener(
                    v -> {
                      try {
                        double a = Rules.coordinate(lat.getText().toString(), 90),
                            b = Rules.coordinate(lon.getText().toString(), 180);
                        d.dismiss();
                        confirmLocation(order, a, b, "Manually entered coordinates");
                      } catch (Exception e) {
                        showError(e.getMessage());
                      }
                    }));
    d.show();
  }

  private void confirmLocation(String order, double lat, double lon, String source) {
    new AlertDialog.Builder(this)
        .setTitle("Share this location?")
        .setMessage(
            source
                + "\n"
                + lat
                + ", "
                + lon
                + "\nThis point will be visible to the retailer and distributor for this order.")
        .setNegativeButton("Cancel", null)
        .setPositiveButton(
            "Share",
            (d, w) ->
                request(
                    "POST",
                    "/api/tracking",
                    object("order_id", order, "latitude", lat, "longitude", lon),
                    null,
                    r -> {
                      toast("Location shared.");
                      refresh();
                    },
                    true))
        .show();
  }

  private void gps(String order) {
    locationCapture.start((lat, lon, source) -> confirmLocation(order, lat, lon, source));
  }

  private void stopGps() {
    if (locationCapture != null) locationCapture.stop();
  }

  @Override
  public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
    super.onRequestPermissionsResult(request, permissions, results);
    if (request == 10) locationCapture.permissionResult();
  }
}
