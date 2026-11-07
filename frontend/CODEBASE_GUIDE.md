# SupplyLink Web Frontend — Codebase Guide

This guide covers how the web frontend is built: the languages and tools it uses, how the folders are organised, and the conventions the code follows. For setup and run commands, see [README.md](README.md).

---

## 1. Languages

| Language | Where it is used |
|---|---|
| **TypeScript (TSX)** | All application code under `src/` (`.ts` for logic, `.tsx` for React components). Compiled in `strict` mode. |
| **CSS** | A single global stylesheet, `src/styles.css`, that imports Tailwind CSS v4 and defines theme tokens and hand-written component classes. |
| **HTML** | `index.html`, the Vite entry page that mounts `#root`. |
| **JSON** | Configuration (`package.json`, `tsconfig*.json`, `.oxlintrc.json`). |

There is no plain JavaScript in `src/`.

---

## 2. Tech stack

| Concern | Library / tool | Notes |
|---|---|---|
| UI framework | **React 19** | Function components and hooks. The only class component is `ErrorBoundary` in `App.tsx`. |
| Build / dev server | **Vite 8** with `@vitejs/plugin-react` | The dev and preview servers proxy `/api` to the backend (`API_PROXY_TARGET`, default `http://127.0.0.1:8000`). |
| Routing | **React Router 7** (`react-router-dom`) | `BrowserRouter` with nested routes under a persistent `AppShell`. |
| Global state | **Redux Toolkit** + `react-redux` | One slice per page, plus `auth` and `shell`. |
| Server mutations / quotes | **TanStack React Query 5** | Used for mutation lifecycles (`useMutation`) and the cart quote (`useQuery`), **not** for page data. |
| Forms & validation | **react-hook-form** + **zod** (via `@hookform/resolvers`) | Used on Login and Register. Other dialogs use controlled `useState` forms. |
| Styling | **Tailwind CSS 4** (`@tailwindcss/vite`) + custom CSS classes | Design tokens are declared in `@theme`; most styling is semantic class names (`.card`, `.btn-primary`, `.stats`). |
| Icons | **lucide-react** | |
| Spreadsheet import | **xlsx** (SheetJS) | Loaded with a dynamic `import('xlsx')` only when a user picks an inventory file. |
| Testing | **Vitest 5** + **jsdom** + **Testing Library** (`react`, `jest-dom`, `user-event`) | |
| Linting | **oxlint** | Plugins: `react`, `typescript`, `oxc`. Enforces `rules-of-hooks` and `only-export-components`. |
| Type checking | **TypeScript 6** (`tsc -b`) | Project references: `tsconfig.app.json` (browser code) and `tsconfig.node.json` (`vite.config.ts`). |

`eslint`, `prettier` and `msw` are listed in `devDependencies` but have no config files and are not used in `src/`. Linting runs only through oxlint.

---

## 3. Folder structure

```
frontend/
├── index.html                # Vite HTML entry
├── vite.config.ts            # Vite + Vitest config, /api proxy
├── tsconfig.json             # Project references root
├── tsconfig.app.json         # Strict TS settings for src/
├── tsconfig.node.json        # TS settings for vite.config.ts
├── .oxlintrc.json            # Lint rules
├── .env.example              # VITE_API_BASE_URL, API_PROXY_TARGET
├── public/
│   ├── _redirects            # SPA fallback for Netlify (/* → /index.html 200)
│   ├── favicon.svg
│   └── icons.svg
└── src/
    ├── main.tsx              # Bootstraps React: StrictMode → Redux Provider → AppProviders → App
    ├── App.tsx               # Routes, role guards, lazy screens, ErrorBoundary
    ├── styles.css            # Tailwind import, @theme tokens, all component CSS, media queries
    ├── types.ts              # Shared domain types (User, Order, Product, Batch, LicenseStatus…)
    │
    ├── screens/              # One file per route: <Name>Screen.tsx
    │   ├── DashboardScreen.tsx, CatalogScreen.tsx, OrdersScreen.tsx, …
    │   ├── LoginScreen.tsx, RegisterScreen.tsx, LicenseLockScreen.tsx
    │   └── pageContracts.test.tsx
    │
    ├── components/
    │   ├── index.ts          # Barrel: re-exports domain/, layout/, ui/
    │   ├── ui/               # Generic, app-agnostic building blocks
    │   │   ├── primitives.tsx  # Button, IconButton, Card, Modal, ConfirmDialog, Badge, Avatar, Toast…
    │   │   ├── forms.tsx       # FormField, Input, Select, SearchInput, Tabs, QuantityStepper
    │   │   └── data.tsx        # DataTable, StatCard, charts and other data display
    │   ├── layout/           # AppShell (sidebar + topbar), PageDataBoundary, WorkspaceSkeleton
    │   ├── domain/           # Business-aware shared pieces (OrderTable, TaxBreakdown, StateSelect…)
    │   ├── auth/             # AuthStory illustration shared by Login/Register
    │   ├── catalog/          # Cart dialog
    │   ├── orders/           # OrderDetail dialog
    │   ├── inventory/        # ProductForm, ReceiveBatchForm, BatchList, BatchActionForm, Dialog type
    │   └── people/           # NewAccount, ReviewRegistration dialogs
    │
    ├── state/
    │   ├── store.ts          # configureStore, typed hooks (useAppDispatch, useAppSelector)
    │   ├── pageContext.ts    # PageContext + usePageData<'page'>() hook
    │   ├── navigationCache.ts# Caches last verified role in sessionStorage (display only)
    │   └── pages/
    │       ├── createPageSlice.ts    # Factory: per-page load thunk + reducer
    │       ├── createPageMutation.ts # Factory: command thunk that invalidates dependent pages
    │       ├── events.ts             # invalidatePages / refreshPages actions
    │       ├── types.ts              # PagePayloads map and PageName union
    │       ├── index.ts              # pagesReducer + pageLoaders lookup
    │       ├── authSlice.ts          # loadMe, signIn, signOut, registerAccount
    │       ├── shellSlice.ts         # Unread notification count for the top bar
    │       └── <page>Slice.ts        # dashboard, catalog, orders, deliveries, payments, credit,
    │                                 # inventory, people, pricing, activity, business,
    │                                 # directory, notifications
    │
    ├── providers/
    │   └── AppProviders.tsx  # QueryClientProvider, AuthProvider (useAuth), ToastProvider (useToast)
    │
    ├── lib/                  # Framework-free helpers
    │   ├── http.ts           # fetch wrapper: CSRF, idempotency keys, ApiError, 401/423 hooks
    │   ├── helpers.ts        # money(), date(), label(), canAccess(), downloadCsv()
    │   ├── checkout.ts       # Pure builders for quote/order request bodies
    │   ├── license.ts        # Clears React Query business cache when the licence locks
    │   └── constants.ts      # ROLE_NAMES, Indian STATE_NAMES (GST codes), ORDER_STATUSES
    │
    └── test/
        └── setup.ts          # jest-dom matchers + Testing Library cleanup
```

### Organisation rules

- **Screens are route-level.** Each route has exactly one `src/screens/<Name>Screen.tsx` that exports a named component (`export function Dashboard()`).
- **Components are grouped by layer, then by feature.** `ui/` holds generic primitives, `layout/` holds the app frame, `domain/` holds shared business widgets, and feature folders (`catalog/`, `orders/`, `inventory/`, `people/`, `auth/`) hold dialogs and forms used by one or two screens.
- **Barrel files** (`index.ts`) re-export each component layer, so screens import from `'../components'`.
- **There is no `api/` folder.** Each request is defined inside the Redux slice that owns it, using the shared `lib/http.ts` transport.
- **Tests sit next to the code they test** (`http.ts` and `http.test.ts`).

---

## 4. Architecture and data flow

```
main.tsx
 └─ <Provider store>               Redux store
     └─ <AppProviders>             React Query + Auth context + Toasts
         └─ <App>                  ErrorBoundary → BrowserRouter → Routes
             └─ <Protected>        session / licence / role guard
                 └─ <AppShell>     persistent sidebar + top bar + <Suspense><Outlet/>
                     └─ <PageDataBoundary page="orders">
                         └─ <Orders/>   reads data via usePageData<'orders'>()
```

1. **Authentication.** `AuthProvider` dispatches `loadMe()` on boot. Until it resolves, `Protected` shows "Checking your session…". The `useAuth()` hook exposes the user, licence, `login` and `logout`.
2. **Guards.** `Protected` redirects to `/login` when there is no user, shows `LicenseLock` when `license.usable` is false, and sends the user to `/` when their role is not allowed on the route.
3. **Page data.** `PageDataBoundary` reads `state.pages[page]` and dispatches that page's loader when its status is `idle`. The screen renders only once data exists, and receives it through `PageContext` and the typed `usePageData<'page'>()` hook.
4. **One endpoint per page.** Each slice calls `GET /api/<page>`. `PagePayloads` in `state/pages/types.ts` types each response as a `Pick<AppState, …>` of the fields that page needs.
5. **Mutations.** Commands are built with `createPageMutation(name, execute, affectedPages)`. After success they dispatch `invalidatePages([...])`, which resets those pages to `idle`. Mounted pages refetch immediately; other pages refetch on their next visit.
6. **Stale data.** On window focus or tab visibility, `refreshPages` marks `ready` pages as `idle` without cancelling in-flight requests.
7. **Code splitting.** All workspace screens are `React.lazy` via a `lazyScreen()` helper. Login, Register and LicenseLock are loaded eagerly.

---

## 5. Coding measures and conventions

### Type safety
- `strict: true`, plus `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `erasableSyntaxOnly` and `verbatimModuleSyntax`. Type-only imports must use `import type`.
- Domain models are centralised in `src/types.ts`. Unions are used for enumerations (`Role`, `OrderStatus`, `PaymentStatus`).
- Generics carry page types end to end: `createPageSlice<P extends PageName>`, `usePageData<P>()`, `DataTable<T>`, `Tabs<T extends string>`.
- `satisfies` checks constant shapes without widening them, as in the `nav` array in `AppShell.tsx`.
- Discriminated unions model UI state, as in `components/inventory/types.ts`: `Dialog = { kind: 'product' } | { kind: 'batches' } | …`.

### State management safeguards (`createPageSlice.ts`)
- **Request de-duplication:** the thunk `condition` skips a load while the same page is already `loading`.
- **Late-response protection:** each load stores `requestId`, and responses with a different ID are ignored.
- **Session isolation:** every page cache resets on `clearSession`, `setAuth`, `signIn`, `signOut`, or a licence that becomes unusable.
- **AbortSignal** is passed from the thunk to `fetch`, so requests can be cancelled.

### Network and security (`lib/http.ts`)
- One `request<T>()` function handles all HTTP. A request with a body becomes a `POST` with JSON.
- **CSRF:** the `X-CSRF-Token` header is sent on every mutation. The token comes from the auth response and is never persisted.
- **Idempotency:** order creation sends an `Idempotency-Key` from `createIdempotencyKey()` (`crypto.randomUUID`). The key is regenerated whenever the cart changes.
- **Credentials:** `same-origin` when proxied, `include` when `VITE_API_BASE_URL` is an absolute URL (for example, a Netlify frontend with a Render backend).
- **Typed errors:** `ApiError` carries `status`, `code` and `license`. A `401` triggers a global sign-out, and a `423 SOFTWARE_LICENSE_BLOCKED` triggers the licence lock.
- **CSV injection protection:** `downloadCsv()` prefixes cells that start with `= + - @ \t \r` and escapes quotes.
- **Minimal persistence:** only the last verified role is stored in `sessionStorage`, for sidebar display. Tokens, licence and page data are never stored. Storage access is wrapped in `try/catch`.

### React patterns
- Function components with named exports. Default export is used only for `App`, and for slice reducers.
- Context and custom hooks for cross-cutting concerns: `useAuth()`, `useToast()`, `usePageData()`. The hooks throw when used outside their provider.
- `useCallback` and `useMemo` keep the auth context value stable.
- An `ErrorBoundary` class component catches render errors app-wide.
- Screens own local UI state (filters, search query, selected row, open dialog) with `useState`.

### UI, accessibility and UX
- Reusable primitives (`Button` with `primary | secondary | ghost | danger` variants, `Modal`, `Badge`, `Tabs`) keep the UI consistent.
- ARIA attributes throughout: `role="dialog"` with `aria-modal`, `role="tablist"` with `aria-selected`, `role="progressbar"`, `role="alert"` and `role="status"`, and `aria-label` on icon-only buttons (`IconButton` requires a `label` prop).
- Layout-matched skeleton loaders (`WorkspaceSkeleton`) instead of spinners. The shell stays mounted during loads.
- Responsive CSS breakpoints at **1150px**, **850px** and **620px**, with an off-canvas sidebar on mobile.
- `prefers-reduced-motion` disables skeleton animations.
- Localisation for India: amounts are stored in **paise** and formatted as INR via `Intl.NumberFormat('en-IN')`, and dates use the `en-IN` locale.

### Code style
- 2-space indentation, single quotes, no semicolons.
- Many JSX trees are written on a single long line. There is no formatter config, so keep the style of the surrounding code.
- File naming: `PascalCase.tsx` for components and screens, `camelCase.ts` for logic and slices, `*.test.ts(x)` for tests.

---

## 6. Testing

Run with `npm test` (Vitest, jsdom environment, `src/test/setup.ts`).

| Test file | What it covers |
|---|---|
| `lib/http.test.ts` | CSRF and idempotency headers, 401 callback, 423 licence-lock callback |
| `lib/helpers.test.ts` | Money and date formatting, role route access |
| `lib/checkout.test.ts` | Quote and order request builders |
| `lib/license.test.ts` | Business cache cleared when the licence locks |
| `state/pages.test.ts` | Per-page API selection, independent caches, invalidation, late-response protection |
| `state/navigationCache.test.ts` | Role caching, malformed values, storage unavailable |
| `components/layout/AppShell.test.tsx` | Navigation stays mounted while sessions and lazy routes load |
| `components/ui/data.test.tsx` | `DataTable` rendering and empty state |
| `screens/pageContracts.test.tsx` | Each screen renders with its page payload for every allowed role |

`fetch` is stubbed with `vi.stubGlobal`, so tests never reach the network.

---

## 7. Scripts and configuration

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server with the `/api` proxy |
| `npm run build` | `tsc -b` type check, then `vite build` |
| `npm run lint` | oxlint |
| `npm run typecheck` | Type check only |
| `npm test` | Vitest run |
| `npm run preview` / `npm start` | Serve the production build with the `/api` proxy |

Environment variables (`.env`, see `.env.example`):

- `VITE_API_BASE_URL`: `/api` when proxied, or a full backend URL ending in `/api` for split hosting.
- `API_PROXY_TARGET`: the backend address for the Vite proxy.

Deployment: `public/_redirects` sends every path to `index.html`, so client-side routing works on Netlify.
