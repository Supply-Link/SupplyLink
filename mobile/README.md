# SupplyLink mobile apps

The apps are in [`retailer/`](retailer/) and [`delivery/`](delivery/). Each is an independent bare React Native project using TypeScript, the React Native Community CLI, Metro, React Navigation, and NativeWind (Tailwind utility classes). They use the same SupplyLink backend and have distinct Android package names. Android native projects are maintained in each app's `android/` directory.

| App | Main screens |
| --- | --- |
| Retailer | Sign in, registration, home, medicines and batches, basket, GST quote and checkout, orders, alerts, business profile, finance/payment history, transaction records, return requests, help |
| Delivery | Sign in, registration, home, assigned deliveries, order details, one-time location sharing, recipient signature and delivery confirmation, collection recording, alerts, account history, help |

The older native Java Android project remains in `app/`, with evaluation APKs in `dist/`. These React Native projects use the same Android package names as their earlier native counterparts. Since the evaluation APKs use a different development signing key, uninstall an old evaluation APK before installing a new debug build.

The two apps follow the web portal's green, lime, and pale-canvas visual tokens. A retailer can submit a return request after delivery; a distributor or admin reviews it in the web order detail. The saved order statement is a transaction record, not a statutory GST invoice. Return approval does not process goods, a refund, or a credit note. Delivery signature capture records a recipient name, signature, and time in the order; no photo is captured. The help screens contain FAQs, not support ticketing.

## Develop and check

Run `npm ci` separately from `mobile/retailer` and `mobile/delivery`. Use Node 22.13+ or Node 24.3+ (Node 24 LTS is suitable; Node 25 is unsupported by this React Native version).

For both apps at once, start one Metro server from each app folder, using a different port:

```sh
npm start -- --host 0.0.0.0 --port 8081  # retailer
# In another terminal, from mobile/delivery:
npm start -- --host 0.0.0.0 --port 8082
```

Run `npm run typecheck`, `npm run lint`, and `npm test -- --watch=false` from either app folder when checking its code.

For each physical phone, enable Android **Developer options → Wireless debugging**. Pair once using the pairing address and code shown there, then connect using the separate IP address and port shown on the Wireless debugging screen:

```sh
adb pair <phone-ip>:<pairing-port>
adb connect <phone-ip>:<debug-port>
adb devices
```

Build, install, and launch each app over that wireless ADB connection (use the device serial shown by `adb devices`):

```sh
# From mobile/retailer:
npm run android -- --no-packager --port 8081 --device <retailer-device-serial>

# From mobile/delivery:
npm run android -- --no-packager --port 8082 --device <delivery-device-serial>
```

On each phone, open the React Native Dev Menu → **Dev settings → Debug server host & port for device**, enter your computer's Wi-Fi IP and that app's Metro port (for example `192.168.1.20:8081` for retailer, `192.168.1.20:8082` for delivery), then reload. Keep both Metro terminals running. After the first install, JavaScript/TypeScript edits appear through Metro; changes to native Android code need a rebuild. Metro has no QR-code launcher.

The apps ask for a server origin at sign-in. Android emulators can reach a backend on the host at `http://10.0.2.2:8000`; a physical device needs your computer's reachable Wi-Fi IP, such as `http://192.168.1.20:8000`. Release builds require a trusted HTTPS origin, with no `/api` suffix. Accounts require administrator approval, and business features require a valid server licence.

## Build Android APKs

From either app folder:

```sh
cd android
./gradlew assembleDebug
```

The APK is created at `android/app/build/outputs/apk/debug/app-debug.apk`. Release distribution requires a separately configured signing key. The generated binary needs a reachable HTTPS SupplyLink backend and an activated server licence.

The source code keeps credentials, session data, and the basket in memory; only the selected server URL is saved locally. The delivery app requests foreground location for a single user-confirmed share. It does not request background location. The retailer app requests no location permission.
