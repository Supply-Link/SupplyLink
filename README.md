# SupplyLink

A professional pharmaceutical distribution portal for administrators, distributors, retailers, and delivery partners. The React frontend and Python backend run as separate servers. The backend also hosts a small local LDAP directory, and records persist in PostgreSQL. Supabase PostgreSQL is used for the current hosted database; the same configuration supports a later PostgreSQL deployment on EC2.

## Monorepo layout

- `frontend/` — React and Vite web portal
- `backend/` — FastAPI, application services, LDAP, PostgreSQL persistence, tests, and licence tooling
- `mobile/` — Expo/React Native retailer and delivery apps, plus the earlier native Android project
- `docs/` — shared product documentation

## Start

Python 3.9+ and Node.js on macOS or Linux. Create the backend environment file and install its dependencies:

```sh
cd /path/to/supplylink/backend
cp .env.example .env
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

Set `DATABASE_URL` in `.env` to the PostgreSQL connection URL. Never commit that file or expose its value through a frontend `VITE_*` variable. Then start the backend:

```sh
python server.py
```

- Backend API: **http://127.0.0.1:8000/api**
- Local LDAP: **ldap://127.0.0.1:1389**
- Base DN: **dc=supplylink,dc=local**
- Storage: PostgreSQL (`DATABASE_URL`)

`server.py` starts FastAPI through Uvicorn. `backend/app/main.py` composes the application; `routes/` defines endpoints, `controllers/` handles HTTP input/output, `services/` owns authentication and transaction boundaries, and `models/` owns business rules, page projections, and persistence. The React application is the view layer. See [backend architecture and page APIs](backend/README.md).

`backend/legacy_server.py` and the deprecated `GET /api/state` remain compatible with regression tests and the existing mobile clients. Web pages use individual role-aware APIs. Existing command URLs and session/CSRF rules are unchanged. The versioned `backend/contracts/supplylink/v1/operations.proto` is a draft internal gRPC boundary; this release does not run a gRPC server.

In a second terminal, start the frontend:

```sh
cd /path/to/supplylink/frontend
cp .env.example .env
npm install
npm run dev
```

- Portal: **http://127.0.0.1:5173**
- Registration: **http://127.0.0.1:5173/register**

The frontend uses `VITE_API_BASE_URL=/api` and proxies that same-origin path to `API_PROXY_TARGET`. This preserves session-cookie and CSRF protection. Opening port 8000 directly exposes only the JSON API, not the React application. The PostgreSQL URL is backend-only and must never be added to `frontend/.env`.

The web portal uses Redux Toolkit with an authentication slice and one slice per page under `frontend/src/state/pages/`. Each page slice calls its own API and tracks its own data, pending request, and errors. Saves invalidate dependent page caches; only mounted pages refetch. React Query manages form mutations and cart quotes. Skeletons stay inside the content area while navigation remains visible. See [frontend data flow](frontend/README.md).

Both backend listeners bind to localhost by default; LDAP is always loopback-only. Use `--port 8080 --ldap-port 1390` for alternative backend settings, or `--no-ldap` for the API alone. If a requested port is unavailable, startup fails with an error instead of silently omitting the directory. If the API port changes, update `API_PROXY_TARGET` in `frontend/.env`.

### Production frontend build

For a local production-build check:

```sh
cd frontend
npm run build
npm start
```

This serves `frontend/dist` on **http://127.0.0.1:4173** and proxies `/api` to port 8000. Vite preview is for local verification; a shared deployment should serve `frontend/dist` with Caddy, Nginx, or another static server configured to proxy `/api` to the backend.

## Demo sign-in

Use the demo buttons or these accounts. All initial passwords are **Demo@123**.

| Role | Email | LDAP bind DN |
| --- | --- | --- |
| Administrator | admin@supplylink.local | uid=admin,ou=people,dc=supplylink,dc=local |
| Distributor | distributor@supplylink.local | uid=distributor,ou=people,dc=supplylink,dc=local |
| Retailer | retailer@supplylink.local | uid=retailer,ou=people,dc=supplylink,dc=local |
| Second retailer | retailer2@supplylink.local | uid=retailer2,ou=people,dc=supplylink,dc=local |
| Delivery partner | delivery@supplylink.local | uid=delivery,ou=people,dc=supplylink,dc=local |

Use separate browser profiles/private windows for simultaneous roles. Tabs in one browser profile share the session cookie. Reload to see updates from other users. The initial catalog contains 24 generic medicine entries. All seeded prices, manufacturers, batches, dates, MRP, stock, and tax configuration are sample data.

## Registration and administrator approval

1. A user opens `/register` and submits their name, business, email, password, address, state, and requested retailer/distributor/delivery role. GSTIN and drug licence number are optional.
2. Registration creates a **pending, inactive** account. Supplied active flags, credit limits, and administrator-role requests cannot grant access.
3. An administrator opens **People & roles → Pending requests → Review access**, selects the approved role, and approves or rejects the request. Rejections record a reason and may be reviewed again.
4. Approval enables web and LDAP sign-in with the registered password. Retailer credit initially starts at zero; administrators configure it separately.
5. Deactivation disables both entry points and permanently revokes existing web sessions. Existing LDAP connections recheck account status before subsequent searches.

Administrators may also create approved accounts directly. Business/GST and drug-licence identifiers are format-checked and stored; government registry verification and email verification are not connected. There is no password reset or account recovery workflow yet.

## Medicine and batch inventory

**Medicine master:** display name, generic name, strength, dosage form, manufacturer, brand/catalog label, trade pack, SKU, category, storage conditions, HSN, configurable GST rate, selling price excluding GST, reorder threshold, and availability.

**Each batch:** batch ID/lot number, manufacturing date, expiry date, available quantity in trade packs, MRP per pack including GST, purchase price excluding GST, and quarantine status.

- Administrators/distributors create medicines, then use **Batches → Receive batch** to record stock and batch facts.
- Stock adjustments require a batch and reason. They cannot make unreserved stock negative. Quarantine/release actions also require a reason.
- Orders reserve available batches in **first-expiry-first-out** order and may split quantities across batches.
- Expired and quarantined stock is excluded from ordering. Confirmation, packing, and dispatch reject expired or quarantined reserved batches.
- Expiry is valid through the entered calendar date, using India time. If a label lists only month/year, enter its final day. The portal highlights available batches expiring within 90 days.
- Selling price including configured GST must not exceed the selected batch MRP.
- Cancellation restores the same batch quantities and releases trade credit once. Retailers can cancel placed/confirmed unpaid orders; administrators/distributors may also cancel packed unpaid orders before dispatch.
- Purchase costs are hidden from retailer responses. Delivery partners receive only assigned orders and no catalog inventory.

## GST and order records

Configure **Business & GST** for the supplier/buyer legal name, address, GSTIN, registered state, and drug licence. Administrators can maintain multiple business profiles; other business roles can edit only their own.

New checkout uses a server-calculated quote. Selling prices exclude GST; the final total includes GST. Discounts apply before tax. The explicitly selected delivery state/place of supply determines the sample intra-state CGST+SGST (or CGST+UTGST for applicable Union Territories) or interstate IGST split. Each component rounds half-up to paise; independently rounded local components can differ by one paisa from a combined IGST calculation.

Order records retain original batch allocations, manufacturing/expiry dates, MRP, HSN, rates, taxable amounts, tax components, and business profiles. Later product/profile changes do not rewrite them. A stale displayed total is rejected at order placement. Order details provide a tax summary, **not a statutory GST invoice**. Invoice issuance, GST returns, e-invoicing, special place-of-supply cases, and tax classification verification are not implemented.

The seed uses a configurable **sample 5% GST rate and HSN heading 3004**, not a verified item-specific classification. Confirm real rates/classifications before using commercial data. Reference: [Government of India medicine GST reforms](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2163785&lang=2&reg=48) and [CBIC tax-invoice particulars](https://cbic-gst.gov.in/gst-invoice-rules.html).

## Fulfilment, payments, and tracking

Retailer places an order → distributor confirms → packs → assigns a delivery partner and dispatches → assigned partner completes delivery. The order timeline has a distinct icon for every stage and cancellation. Notifications are in-portal.

Orders support cash on delivery or internal trade credit. Credit is reserved at placement and released upon cancellation or recorded payment. Payments are **manual records of money received outside the portal**. Record the full delivered order amount and a receipt reference once; duplicate order/payment requests are protected by idempotency keys. The retailer app can request a return and web staff can approve or reject that request; physical returns, refunds and credit notes are not processed. GPS is explicitly shared once by the driver or entered manually; continuous tracking is not implemented.

## Local LDAP directory

This is a small read-only **LDAPv3 protocol service**, not OpenLDAP or Active Directory. Portal login and LDAP simple bind use the same file-directory authentication function, password hashes, approval status, and active flag. The portal does not depend on a loopback LDAP network call for its own login.

Supported operations: LDAPv3 simple bind, anonymous root-DSE discovery, base/one-level/subtree search, equality/presence/substring/AND/OR/NOT filters, unbind, and Who Am I. Anonymous user enumeration is denied. Administrators can search all directory users; other users see only their own record and role membership. Group entries are under `ou=groups`. Password hashes, session tokens, tax identifiers, and addresses are never exposed as LDAP attributes.

Unsupported: LDAP writes (modify/add/delete/rename), SASL, paging, StartTLS, full schema services, replication, and external LDAP synchronization. Critical unsupported controls are rejected. Manage users in the portal. Plain LDAP is loopback-only development mode; optional LDAPS can be enabled with your certificate and key:

```sh
python3 server.py --ldap-cert /path/to/server.crt --ldap-key /path/to/server.key
```

This uses TLS 1.2+ and the configured LDAP port. Use `ldaps://127.0.0.1:1389` with a certificate trusted by the client and valid for that hostname/IP. The application does not generate or install trust certificates.

Example using installed OpenLDAP client tools (password prompt):

```sh
ldapwhoami -x -H ldap://127.0.0.1:1389 -D 'uid=admin,ou=people,dc=supplylink,dc=local' -W
ldapsearch -x -H ldap://127.0.0.1:1389 -D 'uid=admin,ou=people,dc=supplylink,dc=local' -W -b 'ou=people,dc=supplylink,dc=local' '(objectClass=inetOrgPerson)' uid cn mail title
```

## PostgreSQL persistence and migration

Passwords use salted PBKDF2-SHA256; sessions store token hashes. The portal uses HttpOnly/SameSite session cookies, CSRF tokens, origin checks, server-side roles/ownership, input validation, and basic sign-in/registration/bind throttling.

PostgreSQL uses normalized tables for users, products, batches, orders, order parties, order lines, batch allocations, status history, tracking points, payments, notifications, sessions, audit events, and pricing. Primary keys, foreign keys, unique constraints, checks, and role/workflow indexes are defined in `backend/db/schema.sql`. Immutable order-party, price, batch, and tax facts remain separate from current product and user records. All money remains integer paise.

The domain layer still applies each business action atomically. A PostgreSQL advisory transaction lock preserves the existing cross-entity ordering and stock guarantees while the API and LDAP service share the same data. An empty database creates the schema and seed records automatically. If the old `supplylink_state` JSONB table exists, startup backs it up in `migration_backups` and migrates it once into the normalized tables.

To replace the database with an existing file, stop application writers and run:

```sh
cd /path/to/supplylink/backend
source .venv/bin/activate
python migrate_json.py data/portal.json --replace
```

The importer validates the application-data version and stores both the current database state and imported source in `migration_backups` before replacement. Existing order totals/history remain unchanged. Legacy orders are not assigned invented batch or tax facts.

Use managed PostgreSQL backups for Supabase and configure equivalent automated backups before moving the database to EC2. Retaining records during that move requires a controlled PostgreSQL dump and restore; after restoration, update `DATABASE_URL` and `DATABASE_SSLMODE`. No frontend database configuration changes. Do not manually change related rows while the service is running.

All SupplyLink and retained legacy tables have PostgreSQL Row Level Security enabled. No `anon` or `authenticated` policies are defined, and those roles have no table privileges, so Supabase's browser-facing Data API cannot access business records. Only the backend's database-owner connection is permitted to use the tables. Do not add public RLS policies for these tables; application authorization belongs in the Python API.

## Testing

```sh
cd /path/to/supplylink/backend
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v
```

Tests use temporary file or memory adapters and isolated HTTP/LDAP ports; they never read `DATABASE_URL` or modify live PostgreSQL records. FastAPI contract tests cover login, workspace access, order writes, CSRF, origin checks, logout and licence lock. The legacy HTTP adapter regression suite continues to cover fulfilment/payment, persistence and migration, role/record isolation, approval/rejection, LDAP, batch allocation, tax snapshots, idempotency and concurrency. Native LDAP-client checks require `ldapsearch` and `ldapwhoami`; they skip when unavailable.

## Operational limits

This remains a demonstration with demo credentials. A shared deployment needs a managed Uvicorn process behind HTTPS, `COOKIE_SECURE=1`, replacement credentials, restricted PostgreSQL network access, recovery workflows, reliable backups, and monitoring. Real pharmaceutical operation also needs validated supplier/licence/tax data, prescription/dispensing requirements, physical returns, and cold-chain workflows where relevant. These integrations are not implied by the sample catalog.

Generic medicine references: [CDSCO National List of Essential Medicines 2022](https://cdsco.gov.in/opencms/resources/UploadCDSCOWeb/2018/UploadConsumer/nlem2022.pdf). Batch-label reference: [CDSCO Drugs Rules](https://www.cdsco.gov.in/opencms/opencms/en/Acts-and-rules/Drugs-Rules/).

## Software expiry and distributor secret store

The software licence is separate from business data and user roles. The backend reads an offline, RSA-SHA256 signed licence from `backend/.secrets/software-license.json` and verifies it with `backend/config/license-public.pem`. The secret-store directory uses owner-only permissions (0700), and the signed licence file uses 0600. Expiry metadata is signed rather than encrypted. The signing private key is kept **outside the application folder**, at the issuer/distributor, and must never be included in a customer distribution or Git repository.

For this workspace, keep the issuer as a sibling of the SupplyLink monorepo:

```text
../supplylink-issuer/license-signing-private.pem
```

Back that key up securely. Losing it prevents issuance of licences accepted by the existing verification key. Normal portal administrators cannot change software expiry through any portal API or business-data field.

### Set the expiry date before distribution or renew it later

From the `backend/` directory, substitute the agreed expiry date:

```sh
python3 license_admin.py issue \
  --private-key ../../supplylink-issuer/license-signing-private.pem \
  --expires YYYY-MM-DD \
  --customer 'Customer name'
python3 license_admin.py status
```

The expiry date remains **unconfigured until the distributor sets it**; no commercial expiry or trial duration is assumed. A licence is valid through the final instant of its expiry date in Asia/Kolkata, and becomes expired at 00:00 on the following day. For example, a licence ending 2026-12-31 blocks business actions from 2027-01-01 00:00 India time.

If setting up a new issuer for a separate product distribution, create keys once, with the issuer directory outside that application:

```sh
python3 license_admin.py init-issuer --issuer-dir /secure/distributor-issuer
```

This refuses to replace existing issuer/verification keys. The `issue` command can write a customer licence to another location with `--output /path/to/customer/.secrets/software-license.json`. Ship the app, its verification key, and the customer's signed licence; do not ship the issuer directory. `.secrets/` and the locally provisioned verification key are excluded from Git, so include them explicitly in a distribution package. OpenSSL or LibreSSL must be available on the server for signature verification and on the issuer machine for signing. No additional Python packages are needed.

### Expired or unavailable licence behavior

- Approved, active users can still sign in and sign out. Wrong passwords, pending registrations, and deactivated accounts remain rejected.
- All business reads and writes are blocked for every role, including administrators: catalog/state access, orders, batch stock, payments, credit, business profiles, account approval/creation, registration, notifications, and tracking. There is no read-only business dashboard after expiry.
- Existing sessions do not bypass the restriction. Server checks run on every business request and again before committing writes, so expiry during a write rolls back the transaction.
- Login/session metadata, licence status, static sign-in assets, and health checks remain available to support sign-in. Expired authentication responses contain only ID, name, and role, not business/credit data.
- LDAP simple bind and authentication identity remain available; LDAP searches are blocked, including on previously bound connections.
- The UI clears its in-memory business state and order basket and presents a sign-in-only screen. It checks expiry using server time, checks on focus/visibility changes, and detects licence replacement within 15 seconds. The backend enforces the cutoff independently of the UI.
- Missing, malformed, modified, wrongly signed, or publicly readable licence files fail closed into login-only mode. No expiry date is read from the PostgreSQL business data.
- Replacing the licence with a valid signed renewal restores access without restarting the application. Existing business records are retained. Already downloaded files cannot be recalled.

Runtime paths may be selected with `--license-file` and `--license-public-key`. These are distributor/server configuration options, not portal permissions.

This is offline enforcement on a trusted host: an owner who can alter application source, replace its trust key, or manipulate the system clock can bypass local software controls. It is not hardware-backed licensing, a cloud secret vault, or protection against a hostile machine administrator.

### Licence verification coverage

The full test suite also covers signature tampering, wrong keys, unsafe permissions, absent/corrupt files, exact India-midnight boundaries, every role's expired login/logout, all business endpoints blocked without data changes, pre-expiry sessions, expiry during a transaction, LDAP bind/search separation, and live renewal without restart. Test-only licences use isolated keys/files and do not set your installation's commercial expiry.

## Cross-platform mobile apps

The primary mobile workspaces are [`mobile/retailer/`](mobile/retailer/) and [`mobile/delivery/`](mobile/delivery/). Both use Expo, React Native, Expo Router, TypeScript, and NativeWind/Tailwind styles. They implement the retailer and delivery workflows below for Android and iOS. See [`mobile/README.md`](mobile/README.md) for development, checks, and EAS build commands. The existing native Java project and its evaluation APKs are retained separately.

## Earlier native Android apps

The `mobile/` Gradle project builds two native Java apps for Android 8.0 and later:

- **SupplyLink Retailer** (`com.supplylink.retailer`): approved-account login and registration, medicine search, batch/manufacturing/expiry/MRP and GST details, basket quantities, server GST quotes, COD/trade-credit checkout, orders and cancellation, stage icons, notifications, business tax profile and payment history.
- **SupplyLink Delivery** (`com.supplylink.delivery`): approved-account login and registration, assigned deliveries, order/batch/tax details and timeline, one-time foreground location sharing with explicit confirmation, delivery confirmation, offline collection recording with receipt reference, notifications and payment history. There is no continuous/background GPS tracking.

Both use the same Python backend and PostgreSQL database as the web portal. Administrators and distributors use the existing web portal; those roles cannot open either mobile workspace. Registrations require administrator approval. These apps require a network connection. No medicine data, basket, password or session is persisted on the phone; only the chosen server URL is saved. Rotating or restarting the app requires signing in again. Business writes are not automatically retried; order and collection requests use idempotency keys for retries within the session.

### Install and connect

Installable **debug/test APKs** are in `mobile/dist/`. These are for local installation and evaluation, not Play Store publication. The main installation remains **unconfigured** for software licensing, so approved accounts can sign in but cannot open business features until a licence is provisioned at distribution.

For an Android emulator, start the backend from `backend/` (`python3 server.py`), then use server URL `http://10.0.2.2:8000` in either app. For a USB-connected Android phone with USB debugging enabled:

```sh
adb install -r mobile/dist/SupplyLink-Retailer-debug.apk
adb install -r mobile/dist/SupplyLink-Delivery-debug.apk
adb reverse tcp:8000 tcp:8000
```

Use `http://127.0.0.1:8000` as the server URL on that phone. The debug build permits plain HTTP only for the emulator host, localhost and 127.0.0.1. A remotely hosted deployment needs a trusted HTTPS endpoint in front of the backend; enter its origin (for example `https://supplylink.example.com`), without `/api` or another path. Android trusts system certificate authorities. Release builds enforce HTTPS for every server URL. The apps contain no licence issuer key, commercial licence or backend data file.

Demo logins are `retailer@supplylink.local` and `delivery@supplylink.local`, password `Demo@123`, once the installation is appropriately licensed. Use separate, approved accounts for real users. The apps use backend authentication, including its existing directory integration; they do not connect directly to an LDAP port.

### Build from source

Install JDK 17, Android SDK platform 35 and build-tools 34.0.0 (the Gradle plugin default). Put your SDK location in `mobile/local.properties` as `sdk.dir=/absolute/path/to/android-sdk`, or set `ANDROID_HOME`. Then:

```sh
cd mobile
./gradlew :app:assembleDebug :app:testRetailerDebugUnitTest :app:testDeliveryDebugUnitTest :app:lintRetailerDebug :app:lintDeliveryDebug
```

Output APKs are under `app/build/outputs/apk/retailer/debug/` and `delivery/debug/`. Run `python3 tools/package.py` from the `mobile/` directory to refresh the `dist/` APKs, source ZIP, installation notes and checksums. The Gradle wrapper pins Gradle 8.9 and its SHA-256 checksum. Both flavours share the native UI/API code, with a separate delivery-only GPS implementation and permission manifest. The retailer APK has no location permission. There are no third-party runtime UI or networking dependencies.

For distribution, build `:app:assembleRelease` and sign each resulting unsigned APK with your Android app signing key using Android Studio or Android build tools. Keep that key private and back it up; use the same key for future updates. Android APK signing is separate from the server's software-licence signing key. The supplied debug APKs use an ordinary development certificate. They should be replaced with your release-signed builds for customer distribution. Do not package the server issuer directory in either APK.

### Android verification

Unit tests cover server URL validation/HTTPS enforcement, monetary formatting, cancellation stages and coordinate bounds. Device instrumentation tests exercise actual Android networking (session cookies, CSRF and role access), registration/approval, GST quote → batch-allocated order → assigned delivery → tracking → delivery → idempotent collection, unconfigured/expired licences, and native login/navigation/checkout/expiry-lock screens.

To repeat device tests, boot an Android emulator, run `python3 mobile/tools/qa_server.py` from the repository root in another terminal, then run:

```sh
cd mobile
./gradlew :app:connectedRetailerDebugAndroidTest :app:connectedDeliveryDebugAndroidTest
```

The QA helper binds only localhost ports 18001–18004. It creates disposable server data and separate test issuer keys/licences inside a temporary directory and removes them on exit. It never activates the main installation. Android tests connect through the emulator's `10.0.2.2` host alias. Device results and HTML reports are generated under `mobile/app/build/reports/`. Actual GPS reception, manufacturer-specific behavior and release deployment require validation on the intended physical phones.
