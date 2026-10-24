# SupplyLink Product Requirements

## Client summary

SupplyLink is a shared medicine-distribution workspace for distributors, pharmacies, administrators, and delivery partners. It replaces disconnected phone calls, messages, spreadsheets, and paper tracking with one view of medicines, batches, orders, deliveries, payments, and trade credit.

This document describes the product in business language. It is not a technical specification or a legal/compliance certification.

## Repository structure

SupplyLink is maintained as a monorepo so the web portal, backend, mobile clients, database schema, tests, and shared documentation can evolve together.

```text
supplylink/
├── frontend/                 React and Vite web portal
│   ├── src/api/              API client, endpoint definitions, and types
│   ├── src/components/       Shared layout, UI, catalog, and order components
│   ├── src/screens/          Authentication and role-specific screens
│   ├── src/lib/              Checkout, licence, constants, and helper logic
│   └── package.json          Frontend scripts and dependencies
├── backend/                  Python API and persistence service
│   ├── app/                  Domain, authentication, LDAP, licensing, and stores
│   ├── db/schema.sql         Normalized PostgreSQL schema and access controls
│   ├── tests/                Backend workflow, security, and licensing tests
│   ├── server.py             HTTP API and local LDAP entry point
│   ├── migrate_json.py       Legacy JSON/JSONB import utility
│   ├── license_admin.py      Offline licence administration
│   └── requirements.txt      Python dependencies
├── mobile/                   Mobile application workspaces
│   ├── app/                  Native Android retailer and delivery source
│   ├── retailer/             Expo/React Native retailer workspace
│   ├── tools/                Mobile packaging and QA backend utilities
│   └── dist/                 Evaluation APKs and distribution artifacts
├── docs/
│   └── PRD.md                Product requirements
├── README.md                 Setup, operation, testing, and distribution guide
└── .gitignore                Generated files, local settings, and secrets
```

Generated dependencies and build outputs such as `.venv/`, `node_modules/`, `build/`, and `dist/` are not application source. Backend `.env`, `.secrets/`, the licence verification key, and all signing keys are excluded from source control. The issuer private key remains outside this monorepo.

## The business problem

Pharmaceutical distribution commonly involves several disconnected steps:

- pharmacies place orders by phone or message;
- stock, batch numbers, and expiry dates are kept in separate records;
- teams cannot easily see who is responsible for an order;
- delivery status and collections are reported manually;
- outstanding trade credit is difficult to reconcile;
- historical batch and tax details are hard to retrieve.

SupplyLink brings these activities into one controlled workflow.

## Product goals

1. Let a pharmacy place a medicine order in less than three minutes.
2. Give distributors an accurate view of available, expiring, quarantined, and expired stock.
3. Make every order traceable from placement through delivery.
4. Preserve the batch and tax information recorded when an order was placed.
5. Give administrators clear control over people, roles, approvals, and trade-credit limits.
6. Provide a simple interface that works on desktop, tablet, and mobile screens.

## Users and responsibilities

### Administrator

- Approves or rejects account requests.
- Assigns roles and activates or deactivates access.
- Manages medicine records, users, pricing rules, business details, and trade-credit limits.
- Reviews orders, deliveries, payments, directory status, and the activity log.

### Distributor

- Manages its medicines, batches, prices, and stock.
- Confirms and packs retailer orders.
- Assigns packed orders to delivery partners.
- Reviews deliveries and records received payments.

### Retailer or pharmacy

- Searches the medicine catalog.
- Reviews pack price, GST, stock, batch, MRP, and expiry information.
- Places cash-on-delivery or trade-credit orders.
- Tracks order progress, payments, and available credit.
- Maintains its business and GST profile.

### Delivery partner

- Sees only assigned deliveries.
- Reviews the delivery address and relevant order details.
- Shares a location only when explicitly requested.
- Confirms delivery and records collection information.

## Current product capabilities

### Access and account approval

- New users may request retailer, distributor, or delivery access.
- Registration does not grant immediate access.
- An administrator reviews each request and grants a role or records a rejection reason.
- Deactivating an account removes portal access while retaining business history.

### Medicine and batch inventory

- Medicine records include name, generic name, strength, dosage form, manufacturer, SKU, pack, HSN, GST, price, storage instructions, and reorder level.
- Each batch records its batch number, manufacturing date, expiry date, stock, MRP, and purchase price.
- Expired and quarantined batches cannot be ordered or dispatched.
- Available stock is reserved from the earliest-expiring eligible batch first.
- The system highlights low stock and batches approaching expiry.
- Stock adjustments and quarantine changes require a reason.

### Ordering and tax summary

- Retailers can search and filter medicines, add pack quantities to an order, and receive a server-calculated quote.
- Discounts are applied before tax.
- The selected place of supply determines whether CGST and SGST/UTGST or IGST is shown.
- The final order stores the original product, batch, price, discount, tax, buyer, and supplier details.
- A changed or stale total is rejected before placement.

### Fulfilment and delivery

The supported order journey is:

1. Retailer places the order.
2. Distributor confirms it.
3. Distributor marks it packed.
4. Distributor assigns a delivery partner and dispatches it.
5. Delivery partner confirms delivery.

Each order includes a timeline. Eligible unpaid orders may be cancelled before dispatch, returning reserved stock and trade credit.

### Payments and trade credit

- Orders can use cash on delivery or internal trade credit.
- Trade credit is reserved when an order is placed.
- Credit is released when payment is recorded or an unpaid order is cancelled.
- The product records payments received outside SupplyLink; it does not move money.
- Order and payment lists can be downloaded as CSV files.

### Notifications and oversight

- Users receive in-product notifications for relevant events.
- Administrators can review an activity log.
- Business and GST identity can be maintained per eligible account.
- A local LDAP directory uses the same approved accounts and roles.

### Software licence

- The installation uses a signed offline software licence.
- Approved users can still sign in when the licence is missing or expired, but all business information and actions remain locked.
- Replacing the licence with a valid renewal restores access without deleting business records.

## Web interface modernization delivered in this phase

The web interface is rebuilt with React and TypeScript while retaining the current business behavior and Python API.

The new interface provides:

- reusable and consistently styled buttons, forms, dialogs, tables, cards, badges, filters, timelines, and charts;
- role-specific navigation and permissions;
- responsive layouts for desktop, tablet, and mobile;
- safer typed API communication;
- clear loading, empty, error, and licence-lock states;
- reusable feature components so future screens can be added more quickly;
- automated frontend tests for core formatting, API safeguards, tables, checkout data, and licence handling.

The existing Android retailer and delivery applications are not redesigned in this phase.

## Data platform and hosting

- The current hosted database is PostgreSQL provided by Supabase.
- The backend is the only application component allowed to connect to PostgreSQL.
- Every application and retained migration table uses Row Level Security with no anonymous or browser-authenticated access policy. Supabase clients cannot query business records directly; all authorization remains in the backend API.
- The database connection URL and related server settings are supplied through a private backend environment file. Credentials must not be committed to source control, printed in logs, or sent to a browser or mobile application.
- The React frontend has its own environment configuration for the `/api` base path and local backend proxy target. Frontend environment variables contain no database credentials.
- Portal records use normalized PostgreSQL tables for accounts, products, batches, orders, order lines, reserved batch allocations, status history, tracking, payments, notifications, sessions, audit events, and pricing.
- Database constraints protect relationships, unique email/SKU/idempotency values, valid monetary values, dates, roles, statuses, and coordinate ranges. Immutable order snapshots remain separate from current product and business-profile records.
- An empty database is initialized with the required tables and demo data. Existing JSON or legacy JSONB records can be backed up and migrated into the normalized structure without changing the frontend or API.
- The planned production database is PostgreSQL installed on the EC2 instance. Moving from Supabase must use a controlled PostgreSQL backup and restore, followed by record-count and workflow verification. After migration, only the backend database URL and SSL setting should need to change; no frontend database setting exists.
- The EC2 deployment must include encrypted connections where applicable, restricted database network access, automated backups, restore testing, monitoring, security updates, and enough disk capacity for retained data and backups.

### Database structure

The authoritative schema is `backend/db/schema.sql`. Core business fields are normalized into PostgreSQL columns. Most business tables also contain an `extra JSONB` field so older or additive fields can be retained during migration without weakening the relational structure.

Configuration and migration:

- `app_metadata` stores the single application data version and creation timestamp.
- `pricing` stores the single bulk-pricing configuration.
- `migration_backups` stores immutable JSONB snapshots taken before and during imports.

Identity and access:

- `users` stores administrators, distributors, retailers, and delivery partners, including approval state, password hash, business identity, GST details, and retailer credit.
- `sessions` stores only hashed session tokens, CSRF tokens, user ownership, and expiry.

Catalog and inventory:

- `products` belongs to a distributor and stores medicine identity, SKU, pricing, tax, availability, and stock summary fields.
- `batches` belongs to a product and stores batch number, manufacturing and expiry dates, stock, MRP, purchase price, and quarantine state.

Orders and immutable snapshots:

- `orders` links the retailer, distributor, and optional delivery partner and stores status, payment state, totals, tax split, place-of-supply data, and idempotency key.
- `order_parties` stores the buyer and supplier business/GST snapshots captured for an order.
- `order_lines` stores the product, quantity, price, HSN, GST, discount, and tax snapshot for each line.
- `order_batch_allocations` stores the exact batches, dates, MRP, and quantities reserved for each line.
- `order_history` stores ordered fulfilment events.
- `tracking_points` stores explicitly shared delivery coordinates and timestamps.

Operations and oversight:

- `payments` records one manual collection per order and protects retries with actor-scoped idempotency keys.
- `notifications` stores user-specific in-product messages and read state.
- `audit_events` stores administrator-visible activity history.

The main relationships are:

- distributor user → products → batches;
- retailer, distributor, and delivery users → orders;
- order → parties, lines, history, tracking points, and payment;
- order line → reserved batch allocations;
- user → sessions and notifications.

Historical order facts are snapshots rather than live catalog lookups. Product or business-profile changes therefore do not rewrite an existing order. Monetary values are stored as integer paise in `BIGINT` columns, while GST and discount rates use basis points.

Unique indexes protect case-insensitive email and SKU values, order numbers, order-placement retries, and payment retries. Check constraints protect roles, approval states, credit limits, GST/state consistency, HSN format, order states, non-negative monetary values, batch dates, coordinate ranges, and session-token format.

Row Level Security is enabled without anonymous or browser-authenticated policies. Supabase `anon` and `authenticated` roles have no direct table or sequence privileges; only the backend database connection accesses business records.

The current normalized store retains one PostgreSQL advisory transaction lock across multi-table business operations. It reads the relational rows into the existing domain model and writes changed state back atomically. More granular row-level command handling can be introduced later if measured write concurrency requires it.

## Important limitations

SupplyLink currently:

- does not process online payments or transfer money;
- does not create a statutory GST invoice or submit tax returns;
- does not verify GSTIN or drug-licence details against government registries;
- does not provide password reset or account recovery;
- does not manage returns, refunds, recalls, or credit notes;
- does not provide continuous background location tracking;
- does not cover prescription validation, controlled-drug rules, or cold-chain monitoring;
- uses sample medicine, price, tax, and batch data for demonstration unless replaced with validated business data.

These capabilities must not be implied to customers until separately implemented and validated.

## Success measures

- A new user understands their workspace without technical assistance.
- A retailer can find a medicine and place a valid order in under three minutes.
- An expired or quarantined batch is never offered for ordering or dispatch.
- Staff can locate the batch and tax history for any saved order.
- Administrators can approve an account and configure retailer credit without developer assistance.
- All four user roles can complete their normal workflow on common desktop and mobile screen sizes.
- Frontend build, type checking, linting, and automated tests pass before a release.

## Suggested next phases

Priorities should be agreed with the client before implementation.

1. Official GST invoices, e-invoicing, credit notes, and tax exports.
2. Returns, refunds, product recalls, and damaged-stock workflows.
3. Password reset, email verification, and optional multi-factor authentication.
4. Online payment collection and payment-gateway reconciliation.
5. Email, SMS, or WhatsApp notifications.
6. Proof of delivery using signature or photo.
7. Live delivery map where legally and operationally appropriate.
8. Bulk medicine and batch import from CSV.
9. Hindi and regional-language support.
10. Multi-distributor hosting, server-side pagination, and advanced reporting.

## Decisions required from the client

- Expected number of distributors, pharmacies, users, products, batches, and orders.
- Whether the system will run on one office machine or as an online hosted service.
- Whether official GST invoicing is required for launch.
- Whether real online payments are required.
- Required languages.
- Required integrations with accounting, ERP, government, SMS, email, or WhatsApp systems.
- Required retention, backup, recovery, audit, and regulatory policies.
- Whether continuous location tracking or proof of delivery is required.

## Release acceptance

The phase is accepted when:

- all current web screens and role workflows are available in the React interface;
- retailer quote and order placement works with batch and tax details;
- distributor confirmation, packing, assignment, and dispatch work;
- delivery completion, location sharing, and collection recording work;
- administrator access approval, inventory, pricing, GST profiles, and credit management work;
- missing or expired licences lock business information and actions;
- the frontend and backend run independently, with `/api` requests securely proxied to the backend;
- backend health reports PostgreSQL storage and saved changes remain available after a backend restart;
- neither the frontend build nor its environment files contain PostgreSQL credentials;
- automated frontend and backend checks pass.

## Timeline and commercial estimate

Timeline and cost should be confirmed only after the client answers the decisions above and agrees which suggested next-phase items are included.
