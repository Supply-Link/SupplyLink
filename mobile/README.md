# SupplyLink mobile apps

The cross-platform apps are in [`retailer/`](retailer/) and [`delivery/`](delivery/). Each is an independent Expo/React Native project using TypeScript, Expo Router, and NativeWind (Tailwind utility classes). They use the same SupplyLink backend and have distinct Android package names and iOS bundle identifiers.

| App | Main screens |
| --- | --- |
| Retailer | Sign in, registration, home, medicines and batches, basket, GST quote and checkout, orders, alerts, business profile, finance/payment history, transaction records, return requests, help |
| Delivery | Sign in, registration, home, assigned deliveries, order details, one-time location sharing, recipient signature and delivery confirmation, collection recording, alerts, account history, help |

The older native Java Android project remains in `app/`, with evaluation APKs in `dist/`. The Expo projects are the source for future Android and iOS builds; the native APKs are not builds of the Expo projects. Each Expo Android app uses the same package name as its earlier native counterpart. Since the evaluation APKs use a different development signing key, uninstall an old evaluation APK before installing an Expo build.

The two apps follow the web portal's green, lime, and pale-canvas visual tokens. A retailer can submit a return request after delivery; a distributor or admin reviews it in the web order detail. The saved order statement is a transaction record, not a statutory GST invoice. Return approval does not process goods, a refund, or a credit note. Delivery signature capture records a recipient name, signature, and time in the order; no photo is captured. The help screens contain FAQs, not support ticketing.

## Develop and check

Run these commands separately from `mobile/retailer` and `mobile/delivery`:

```sh
npm ci
npx expo start
npm run typecheck
npm run lint
npm test -- --watch=false
```

The apps ask for a server origin at sign-in. Android emulators can reach a backend on the host at `http://10.0.2.2:8000`; iOS simulators use `http://127.0.0.1:8000`. A physical device needs a reachable server. Release builds require a trusted HTTPS origin, with no `/api` suffix. Accounts require administrator approval, and business features require a valid server licence.

## Build Android and iOS

Each Expo folder has its own `eas.json` with `preview` (internal testing) and `production` profiles. From **each app folder**, after signing in to an Expo account and completing EAS project and signing setup:

```sh
npx eas-cli@latest build --platform all --profile preview
npx eas-cli@latest build --platform all --profile production
```

EAS builds iOS in the cloud, including when the development machine runs Windows. iOS device distribution and store builds require Apple signing credentials; production Android distribution requires its own signing credentials. The generated binaries need a reachable HTTPS SupplyLink backend and an activated server licence. No build has been submitted to EAS from this repository.

The source code keeps credentials, session data, and the basket in memory; only the selected server URL is saved locally. The delivery app requests foreground location for a single user-confirmed share. It does not request background location. The retailer app requests no location permission.
