# Enterprise React Frontend Engineering Guidelines & Guardrails

**Reference stack:** React, TypeScript, Vite, Redux Toolkit / TanStack Query, React Router, Vitest\
**Purpose:** A practical engineering standard for building maintainable,
secure, accessible, testable, and production-ready web frontends.

> These guidelines are defaults, not universal laws. Follow the
> conventions of the repository and engineering team when they differ.
> Prefer evidence and clear trade-offs over arbitrary rules.

------------------------------------------------------------------------

## 1. Core engineering principles

Optimize for:

1.  **Correctness:** the UI must reflect server state accurately and
    behave predictably.
2.  **Maintainability:** another engineer should be able to understand
    and change a screen safely.
3.  **Simplicity:** use the simplest design that meets current
    requirements.
4.  **Testability:** important behavior must be verifiable
    automatically.
5.  **Security:** treat the browser as untrusted. The server is the
    authority for authentication, authorization, pricing, and
    validation.
6.  **Accessibility:** every user, including keyboard and screen-reader
    users, must be able to complete every task.
7.  **Performance:** ship only the code a user needs, and keep
    interactions responsive.
8.  **Consistency:** follow repository-wide conventions and avoid
    one-off patterns.

Apply these principles:

-   **Single Responsibility:** a component, hook, or module should have
    a cohesive purpose.
-   **DRY:** avoid duplicated knowledge and business rules; do not
    abstract merely to eliminate similar-looking JSX.
-   **KISS:** avoid unnecessary abstraction, indirection, and layers of
    state libraries.
-   **YAGNI:** do not build speculative props, variants, or
    configuration.
-   **Composition over configuration:** prefer composing small
    components (`children`, slots) over one component with dozens of
    boolean props.
-   **Explicit over implicit:** make data sources, side effects, and
    state ownership visible.

------------------------------------------------------------------------

## 2. Recommended project structure

Prefer **feature-based folders** for most applications. Keep the code
for one business capability together, and make dependencies between
features intentional.

``` text
company-web/
├── src/
│   ├── main.tsx                 # Bootstrap: providers + router
│   ├── app/
│   │   ├── App.tsx              # Route table, error boundary
│   │   ├── routes.ts            # Single source for paths, roles, nav labels
│   │   ├── providers.tsx        # Store, query client, theme, auth
│   │   └── store.ts
│   ├── features/
│   │   ├── orders/
│   │   │   ├── components/      # Feature-specific UI
│   │   │   ├── hooks/           # useOrders(), useCancelOrder()
│   │   │   ├── api.ts           # Requests owned by this feature
│   │   │   ├── state.ts         # Slice / query keys, if needed
│   │   │   ├── types.ts         # Feature DTOs and view models
│   │   │   ├── OrdersPage.tsx   # Route-level screen
│   │   │   └── orders.test.tsx
│   │   ├── catalog/
│   │   └── payments/
│   ├── shared/
│   │   ├── ui/                  # Design-system primitives (Button, Modal, Table)
│   │   ├── lib/                 # Stable, framework-free helpers (formatting, dates)
│   │   └── api/                 # HTTP client, error model
│   ├── styles/
│   └── test/                    # Test setup, fixtures, mock server handlers
├── public/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
├── .env.example
└── README.md
```

### Structure guardrails

-   Organize by business capability (`orders`, `catalog`, `payments`)
    rather than creating enormous global `components/`, `hooks/`, and
    `services/` folders.
-   Keep feature-specific components, hooks, types, and requests close
    to the feature that owns them.
-   Keep `shared/` small. Only place genuinely cross-feature, stable
    concepts there.
-   Do not create a generic `utils`, `helpers`, or `common` dumping
    ground.
-   Do not import another feature's internal components or state
    directly. Expose a deliberate entry point (`features/orders/index.ts`)
    or move the shared piece to `shared/`.
-   Keep route-level screens thin: they compose feature components and
    hooks.
-   Define routes, required roles, and navigation labels in **one**
    table. Do not repeat permission lists in the router, the menu, and
    helpers.
-   Barrel files (`index.ts`) are fine at feature boundaries. Avoid deep
    barrel chains that hide where code lives or defeat tree shaking.

For smaller applications a layer-based layout (`screens/`,
`components/`, `state/`, `lib/`) is acceptable. Do not add layers
mechanically.

------------------------------------------------------------------------

## 3. Naming and formatting conventions

| Element | Convention | Example |
|---|---|---|
| Component | PascalCase | `OrderTable` |
| Component file | PascalCase `.tsx` | `OrderTable.tsx` |
| Route-level screen | PascalCase + `Page` / `Screen` | `OrdersPage.tsx` |
| Hook | `use` + camelCase | `useOrderTotals()` |
| Function / variable | lower camelCase | `formatCurrency`, `selectedOrder` |
| Constant | UPPER_SNAKE_CASE | `MAX_UPLOAD_BYTES` |
| Type / interface | PascalCase, no `I` prefix | `Order`, `OrderStatus` |
| String union value | snake_case or kebab-case, matching the API | `'out_for_delivery'` |
| Redux slice / action | camelCase / `domain/eventName` | `ordersSlice`, `orders/cancelled` |
| Query key | array, feature first | `['orders', orderId]` |
| Event handler prop | `on` + Event | `onSelect`, `onClose` |
| Handler implementation | `handle` + Event | `handleSubmit` |
| Test file | source name + `.test` | `OrderTable.test.tsx` |
| CSS class (if not utility CSS) | kebab-case, component-scoped | `.order-table__row` |

### Naming guardrails

-   Use names that communicate intent and domain meaning.
-   Prefer `useOverdueInvoices` over `useData`, and `calculateLineTotal`
    over `process`.
-   Avoid vague names such as `data`, `temp`, `obj`, `item`, `info`,
    and `handleClick2`.
-   Boolean props and variables should read naturally: `isOpen`,
    `hasError`, `canEdit`, `disabled`.
-   Give each component **one** name. Do not export aliases such as
    `Empty = EmptyState`.
-   Use domain vocabulary consistently across UI labels, types, and the
    API.
-   Use one formatter (Prettier) and one linter (ESLint or oxlint) for
    the whole repository, and enforce them in CI.
-   Keep JSX readable: one element per line once a tree has more than
    two or three children or any props that need reading.

------------------------------------------------------------------------

## 4. File size, component size, and function size

React does not define a maximum size for a file or component. Treat
size thresholds as review signals, not hard rules.

Suggested starting heuristics:

| Unit | Typical review target |
|---|---|
| Presentational component | 20–120 lines |
| Route-level screen | 50–200 lines |
| Custom hook | 10–80 lines |
| State slice / query module | 20–150 lines |
| API module (per feature) | 20–120 lines |
| Shared helper module | 20–100 lines |

Signals to review:

-   **JSX nesting deeper than 4–5 levels:** extract a named
    subcomponent.
-   **More than ~5 `useState` calls in one component:** consider a
    reducer, a custom hook, or splitting the component.
-   **More than ~8 props:** check whether the component does too much,
    or whether composition (`children`) would be clearer.
-   **A single JSX line longer than ~120 characters:** format it.
-   **Logic in JSX** (long ternary chains, `?.filter().map().reduce()`
    inline): move it into a named variable or hook.

### Split a component when

-   It renders unrelated sections that change for different reasons.
-   It mixes data fetching, business calculation, and presentation.
-   Part of it re-renders frequently and the rest does not.
-   It is hard to test without setting up unrelated state.
-   A section has a meaningful name of its own.

### Extract a hook when

-   Stateful logic is reused by more than one component.
-   A component's logic can be tested independently of its markup.
-   A side effect (subscription, timer, event listener) has setup and
    cleanup that deserve a name.

Do **not** create one file per tiny component, and avoid components or
hooks that only forward props or calls.

------------------------------------------------------------------------

## 5. Reuse and abstraction rules

Choose the narrowest scope that satisfies the real use cases.

### Scope 1: Local implementation detail

Keep a helper or subcomponent inside the file when only one component
uses it.

``` tsx
function lineTotal(quantity: number, unitPrice: number) {
  return quantity * unitPrice
}
```

### Scope 2: Feature-level behavior

Use a feature hook or component when several parts of one feature need
it.

``` text
features/orders/
├── hooks/useOrderTotals.ts
└── components/OrderStatusBadge.tsx
```

### Scope 3: Cross-feature capability

Move code into `shared/` only when multiple real consumers need the same
stable capability and it does not couple unrelated domains. Examples: a
design-system `Button`, a currency formatter, a date formatter, the
current-user hook.

### Scope 4: Infrastructure adapter

Wrap browser and external APIs behind a small module where useful:

``` text
shared/
├── api/http.ts          # fetch wrapper, error model
├── storage/session.ts   # sessionStorage with try/catch
└── analytics/track.ts
```

### Reuse guardrails

-   Do not export a component or helper just in case another feature
    might use it.
-   Do not move business rules into `shared/` merely because they look
    similar.
-   Do not build a generic form builder, table framework, or component
    factory before there are real use cases.
-   Prefer duplication over a misleading abstraction when two pieces of
    UI only look similar but have different meanings.
-   Do not create wrapper components that only forward props to a native
    element (`Input = (p) => <input {...p} />`). Add a wrapper only when
    it adds behavior, styling, or accessibility.
-   When extracting shared code, define ownership, props/inputs, error
    behavior, and tests.

------------------------------------------------------------------------

## 6. Layer responsibilities

Keep dependencies flowing in one direction:
**screens → feature components/hooks → state/API → shared lib**.

### Route-level screen

Responsible for:

-   Reading route parameters.
-   Composing feature components and hooks.
-   Page layout, title, and loading/error/empty states.

Must not:

-   Call `fetch` directly.
-   Contain pricing, permission, or other business rules.
-   Hold state that belongs to a child component.

### Presentational components

Responsible for rendering props and raising events. They should be easy
to render in a test without a store or network.

### Hooks and state

Responsible for:

-   Fetching and caching server data.
-   Submitting changes and invalidating stale data.
-   Client-only UI state that must outlive one component.

Must not become one global store for everything. Keep local UI state
(open dialog, input text, selected tab) in the component that owns it.

### API client

Responsible for:

-   URLs, headers, credentials, timeouts, and abort signals.
-   Converting HTTP failures into a typed error.

Must not contain UI concerns (toasts, navigation) except through
explicit callbacks.

### Domain helpers

Pure functions for formatting, calculation, and mapping. No React, no
network, no browser globals. These are the easiest code to unit test.

------------------------------------------------------------------------

## 7. API types, view models, and validation

Treat API responses as **untrusted input** at the edge of the
application.

``` ts
// API contract: what the server sends
export interface OrderResponse {
  id: string
  status: OrderStatus
  total_minor: number      // integer minor units
  created_at: string       // ISO 8601
}

// View model: what the UI needs
export interface OrderRow {
  id: string
  statusLabel: string
  total: string            // formatted for display
  createdAt: Date
}
```

### Guardrails

-   Keep API response types, form values, and view models conceptually
    separate when they differ. Do not reuse one giant type for create,
    edit, and display.
-   Validate untrusted data at the boundary when its shape is not
    guaranteed (for example, with zod). At minimum, type responses
    explicitly. Never use `any` for API data.
-   Validate forms with a schema (zod, yup, or similar) shared by the
    resolver and the TypeScript type. Server validation is still
    required.
-   Represent money as integer minor units or a decimal library. Never
    do currency arithmetic with floating-point values.
-   Do not trust client-side calculations for prices, totals, taxes, or
    permissions. Display the server's result.
-   Hiding a button is **not** authorization. The server must reject the
    action.
-   Be deliberate about `null`, `undefined`, and optional fields. Model
    them in the type, and handle them in the UI.
-   Avoid unchecked type casts (`as T`) that hide mismatches. If a cast
    is necessary, keep it in one place with a comment.

------------------------------------------------------------------------

## 8. Dependencies, providers, and state ownership

Make each piece of state have **one** owner.

| State type | Recommended home |
|---|---|
| Server data (lists, records) | A server-cache library (TanStack Query, RTK Query) **or** a store slice — pick one per application |
| Client state shared across screens | Store slice or Context |
| Local UI state | `useState` / `useReducer` in the owning component |
| URL state (filters, page, tab) | Route parameters or search params |
| Form state | A form library or local state |

Guardrails:

-   Do not wrap one state library inside another (for example, a query
    library calling a store thunk that only calls `fetch`). Choose one
    path for each kind of state.
-   Do not mirror the same data in Context **and** a store. Derive
    instead of copying.
-   Compute derived values during render (or with a selector) instead of
    storing them.
-   Use Context for stable, low-frequency values (current user, theme,
    feature flags). Avoid putting rapidly changing values in a broad
    Context.
-   Custom hooks that read a Context should throw a clear error when the
    provider is missing.
-   Avoid hidden module-level singletons with mutable state. If one is
    needed (for example, an HTTP client's CSRF token), keep it in one
    module with an explicit setter and reset.
-   Keep environment-specific values out of source code (see Section
    13).

------------------------------------------------------------------------

## 9. Errors and user-facing failure states

Every data-driven view has four states: **loading, empty, error, and
success**. Design all four.

``` ts
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message)
  }
}
```

### Guardrails

-   Wrap the application, and optionally each route, in an error
    boundary with a recovery action.
-   Convert HTTP failures into one typed error model in the API client.
-   Show actionable messages to users. Log technical detail to the
    error-reporting service, not the screen.
-   Do not swallow errors (`catch {}`) or show success after a failed
    request.
-   Handle every promise. Mark intentionally ignored promises with
    `void` and make sure their errors are reported elsewhere.
-   Distinguish validation (400), authentication (401), authorization
    (403), conflict (409), and unexpected (5xx) failures in the UI.
-   On 401, clear session data and return the user to sign-in.
-   Keep previously loaded data visible during a failed background
    refresh, with a retry control.
-   Disable submit buttons while a change is pending to prevent double
    submission.

### Loading states and skeletons

Pick the loading indicator that matches the wait.

| Situation | Indicator |
|---|---|
| Content-shaped wait with no data yet (lists, tables, cards, detail pages) | **Skeleton** that matches the final layout |
| Short action started by the user (submit, save, button press) | Inline **spinner** or disabled button with a label |
| Long operation with known progress (upload, import) | **Progress bar** with a percentage or step count |
| Refresh while data is already on screen | Keep the data; show a small, unobtrusive indicator |

Guardrails:

-   Show a skeleton only when there is **no data yet**. During a
    background refresh, keep the existing data visible (see Section 11).
-   Keep the app shell (navigation, header) mounted. Replace only the
    content area with the skeleton.
-   Match the real layout: same container, row heights, column count, and
    spacing. Build one skeleton per layout. Do not reuse a generic grey
    block for every screen.
-   Use the **same** skeleton for the lazy-route fallback and for the
    data load, so the page does not flash through two different loading
    looks.
-   Evaluate states in this order: loading → error → empty → success.
    Never show "No results" while data is still loading.
-   A failed load replaces the skeleton with an error message and a retry
    control. Do not leave a skeleton on screen forever.
-   Delay the skeleton briefly (a starting point is 150–300 ms) so fast
    responses do not flash, and keep it visible for a minimum time
    (around 300–500 ms) once shown so it does not flicker.
-   Load independent sections separately (for example, with their own
    Suspense boundaries) so one slow request does not block the whole
    page.
-   Animate with CSS only (`transform`, `opacity`, or background
    position). Do not drive skeleton animation with JavaScript timers.
-   Respect `prefers-reduced-motion` by turning the animation off.
-   Accessibility: set `aria-busy="true"` on the loading region, include
    visually hidden status text such as "Loading orders…"
    (`role="status"`), and mark decorative placeholder blocks
    `aria-hidden="true"`. Never move focus onto a skeleton.
-   Keep skeleton components small, static, and independent of the data
    they stand in for.
-   Test that the skeleton appears while the request is pending and is
    replaced by the success, empty, or error view.

``` tsx
function OrdersPage() {
  const { orders, error, isInitialLoading, isRefreshing, reload } = useOrders()

  if (isInitialLoading) return <OrdersSkeleton />
  if (error && !orders) return <ErrorPanel message={error} onRetry={reload} />
  if (orders?.length === 0) return <EmptyState title="No orders yet" />

  return <OrderTable rows={orders} refreshing={isRefreshing} />
}
```

``` css
.skeleton {
  background: linear-gradient(90deg, #eee 25%, #f7f7f7 50%, #eee 75%);
  background-size: 200% 100%;
  animation: shimmer 1.2s linear infinite;
}
@keyframes shimmer { to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { .skeleton { animation: none; } }
```

------------------------------------------------------------------------

## 10. Logging and observability

Do not leave `console.log` in production code. Use a small logging or
reporting module so it can be switched by environment.

``` ts
reportError(error, { feature: 'checkout', orderId })
track('order_submitted', { itemCount })
```

### Guardrails

-   Report unhandled errors and error-boundary catches to an error
    tracking service (for example Sentry, or OpenTelemetry for the web).
-   Upload source maps to the error tracker; do not serve them publicly
    unless that is a deliberate decision.
-   Never log or report passwords, tokens, CSRF values, payment data, or
    sensitive personal information.
-   Include useful context: route, feature, release version, and a
    correlation ID returned by the server where available.
-   Measure Core Web Vitals (LCP, INP, CLS) in production.
-   Avoid noisy logs inside render functions or high-frequency events.

------------------------------------------------------------------------

## 11. Data fetching, caching, and state updates

The frontend's equivalent of transactions is **cache consistency**: the
user must never act on data that is silently wrong.

### Guardrails

-   Give each piece of server data one cache owner and one cache key.
-   After a successful change, invalidate or update exactly the data it
    affects. Define those dependencies once, next to the change, not in
    every caller.
-   If a change affects most of the application, invalidate everything
    with one named action instead of listing every page.
-   De-duplicate identical in-flight requests.
-   Ignore late responses from a superseded request, a previous session,
    or a previous user.
-   Pass an `AbortSignal` to requests, and abort them when a component
    unmounts or the input changes.
-   Clear all cached business data on sign-out, user switch, or loss of
    access.
-   Paginate or virtualize large collections. Do not fetch unbounded
    lists.
-   Use optimistic updates only when the rollback path is defined and
    tested.
-   Batch bulk operations (such as file imports) and refresh once at the
    end, not once per row.
-   Refresh on focus or reconnect deliberately, without interrupting a
    request that is already running.

### Example

``` ts
const cancelOrder = useMutation({
  mutationFn: (id: string) => api.post(`/orders/${id}/cancel`),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['orders'] })
  },
})
```

### Redux Toolkit slices and async thunks

Use this pattern only when the application has chosen a store for server
data (Section 8). If RTK Query or TanStack Query is available, prefer it
over hand-written thunks. Never stack the two.

Slice guardrails:

-   Create one slice per feature (or per page) in the feature's own
    folder. The slice owns that feature's data, request status, and
    error.
-   Use `createSlice` and `createAsyncThunk`. Do not hand-write action
    type strings or `switch` reducers.
-   Keep reducers as pure state transitions. They must not call APIs,
    calculate business values, or trigger side effects.
-   Model request state with **one** `status` field
    (`'idle' | 'loading' | 'ready' | 'error'`) and an `error` message,
    not a set of independent booleans that can contradict each other.
-   Keep state **serializable**: store plain objects, ISO date strings,
    and error messages or codes. Do not put `Error` instances, `Date`
    objects, class instances, or functions in the store.
-   Do not copy data that can be derived. Compute it with a selector.
-   Normalize large collections with `createEntityAdapter` when lookups
    or updates by id matter.
-   Define selectors next to the slice. Use `createSelector` for derived
    or filtered data, and select narrow values instead of whole objects
    that change identity on every update.
-   Reset the slice to its initial state when the session ends or the
    user changes (Section 11).
-   Do not let slices dispatch chains of actions into one another; the
    data flow becomes impossible to follow.

Thunk guardrails:

-   Name thunks `feature/verb`: `orders/load`, `orders/cancel`.
-   A thunk calls the shared HTTP client (Section 15), never `fetch`
    directly, and passes the thunk's `signal` through so the request can
    be aborted.
-   Use the `condition` option to skip a load that is already in flight.
-   Store the `requestId` when a load starts, and ignore a fulfilled or
    rejected result whose `requestId` does not match (a late response).
-   Return plain data from the thunk. Reject with a serializable error
    (`rejectWithValue` or the default serialized error), not a raw
    exception object.
-   Declare which data a write invalidates next to the write itself,
    for example by marking dependent slices stale in `extraReducers`. Do
    not make every caller remember the dependencies.
-   Create a thunk factory only when three or more thunks share the same
    pattern. Do not build one for a single use.
-   Do not create a thunk for a call that stores nothing and has no
    shared dependants; call a mutation hook or a plain API function
    instead.

Component guardrails:

-   Use typed hooks (`useAppDispatch`, `useAppSelector`) exported once
    from the store module.
-   Read `status` and `error` from state to render loading and error
    views.
-   Use `.unwrap()` only where the component must react to the outcome of
    a command (close a dialog, show a toast). Handle the rejection.
-   Start loads from an effect keyed on `status === 'idle'`, so marking a
    slice stale causes exactly one reload.

Testing guardrails:

-   Test reducers by passing plain actions.
-   Test thunks with a mocked HTTP client.
-   Cover the duplicate-request, late-response, and reset-on-sign-out
    behaviors.

``` ts
// features/orders/ordersSlice.ts
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { signedOut } from '@/features/session/actions'
import { ordersApi } from './api'
import type { RootState } from '@/app/store'
import type { OrderResponse } from './types'

interface OrdersState {
  items: OrderResponse[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  requestId?: string
}

const initialState: OrdersState = { items: [], status: 'idle', error: null }

export const loadOrders = createAsyncThunk(
  'orders/load',
  (_: void, { signal }) => ordersApi.list(signal),
  {
    // Skip a duplicate load while one is already running.
    condition: (_, { getState }) =>
      (getState() as RootState).orders.status !== 'loading',
  },
)

export const cancelOrder = createAsyncThunk(
  'orders/cancel',
  (id: string, { signal }) => ordersApi.cancel(id, signal),
)

const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadOrders.pending, (state, action) => {
        state.status = 'loading'
        state.error = null
        state.requestId = action.meta.requestId
      })
      .addCase(loadOrders.fulfilled, (state, action) => {
        if (state.requestId !== action.meta.requestId) return // late response
        state.items = action.payload
        state.status = 'ready'
        state.requestId = undefined
      })
      .addCase(loadOrders.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) return
        state.status = 'error'
        state.error = action.error.message ?? 'Unable to load orders.'
        state.requestId = undefined
      })
      // A cancelled order changes the list: mark it stale so it reloads once.
      .addCase(cancelOrder.fulfilled, (state) => {
        state.status = 'idle'
      })
      .addCase(signedOut, () => initialState)
  },
})

export default ordersSlice.reducer
export const selectOrders = (state: RootState) => state.orders
```

``` tsx
// features/orders/useOrders.ts
export function useOrders() {
  const dispatch = useAppDispatch()
  const { items, status, error } = useAppSelector(selectOrders)

  useEffect(() => {
    if (status === 'idle') void dispatch(loadOrders())
  }, [dispatch, status])

  return {
    orders: status === 'ready' || items.length ? items : undefined,
    error,
    isInitialLoading: status !== 'error' && !items.length && status !== 'ready',
    isRefreshing: status === 'loading' && items.length > 0,
    reload: () => void dispatch(loadOrders()),
  }
}

// In an event handler: react to the outcome of a command.
try {
  await dispatch(cancelOrder(orderId)).unwrap()
  toast('Order cancelled.')
} catch (error) {
  toast(error instanceof Error ? error.message : 'Could not cancel the order.')
}
```

------------------------------------------------------------------------

## 12. Security guardrails

The browser is untrusted. Frontend security reduces exposure; it does
not replace server enforcement.

-   **XSS:** rely on React's escaping. Avoid `dangerouslySetInnerHTML`;
    if it is unavoidable, sanitize with a maintained library (for
    example, DOMPurify).
-   Never build URLs for `href` or `src` from untrusted input without
    validating the scheme (block `javascript:`).
-   **Sessions:** prefer `HttpOnly`, `Secure`, `SameSite` cookies set by
    the server. Do not store access tokens in `localStorage`.
-   **CSRF:** send the server's CSRF token on state-changing requests
    when cookie sessions are used.
-   Send idempotency keys for non-idempotent operations that may be
    retried (payments, order creation).
-   **Secrets:** anything in a client bundle or a public build variable
    (`VITE_*`, `NEXT_PUBLIC_*`) is public. Never put secrets there.
-   Set a strict Content-Security-Policy and other security headers at
    the server or CDN.
-   Escape spreadsheet formulas (`=`, `+`, `-`, `@`) in CSV exports.
-   Validate file uploads (type, size) on the client for user feedback,
    and on the server for security.
-   Store only non-sensitive preferences in browser storage, wrapped in
    `try/catch`.
-   Keep dependencies patched and run `npm audit` or an equivalent
    scanner in CI. Review new dependencies before adding them.
-   Load third-party scripts only from trusted origins, with
    Subresource Integrity where possible.

Authentication answers **who is the user?** Authorization answers
**what may they do?** The UI may hide what a user cannot do, but the
server must enforce both.

------------------------------------------------------------------------

## 13. Configuration and environment management

Keep environment-specific configuration outside source code.

Example `.env.example`:

``` dotenv
# Public, build-time values only. Never put secrets here.
VITE_API_BASE_URL=/api
VITE_SENTRY_DSN=
# Dev-server only (not shipped to the browser)
API_PROXY_TARGET=http://127.0.0.1:8000
```

Guardrails:

-   Commit `.env.example`, never `.env`.
-   Read configuration in one module, validate it at startup, and export
    typed values.
-   Do not hardcode environment-specific URLs or ports in components.
-   Use the dev-server proxy for local development so the browser can
    use same-origin requests.
-   Keep defaults safe for local development.
-   Document every required variable.

### URLs, routes, and API paths

Keep URLs simple and stable. Define each URL **once**, and transform it
**at most once**. Every extra layer that rewrites a path is another
place for the frontend, the proxy, the host, and the server to disagree.

API URL guardrails:

-   There is **one** API setting: the base URL (`VITE_API_BASE_URL`). It
    is read in one module, and the HTTP client is the only code that
    joins the base URL and a path.
-   Callers pass a path **relative to the base** (`/orders`), always in
    the same form. Do not pass absolute URLs from components, and do not
    include the base prefix (such as `/api`) in some calls but not
    others.
-   Do not strip, replace, or add prefixes in several layers (client,
    dev proxy, hosting redirect, server). At most one layer maps a
    public URL to a backend URL.
-   Make the dev-server proxy forward the **same** path shape that
    production uses, without rewriting. Local, staging, and production
    should differ only by the value of an environment variable.
-   Define each endpoint path in the API module of the feature that owns
    it (`features/orders/api.ts`). Do not repeat path literals across
    slices, hooks, and components.
-   Build dynamic paths with small functions, encode dynamic segments with
    `encodeURIComponent`, and build query strings with
    `URLSearchParams`. Do not concatenate strings in components.
-   Do not change an endpoint path or its shape without coordinating with
    the backend and updating every caller in the same change. Deployed
    frontends keep calling the old path until they are redeployed.
-   Moving the backend should require changing **one environment
    value**, never edits across several files.

Route guardrails:

-   Declare route paths once, in the route table (Section 2). Navigate
    with route builders (`routes.order(id)`), not string literals.
-   Keep paths flat, lower-case, and readable: `/orders` and
    `/orders/:orderId`. Avoid deep nesting and computed or
    optional-heavy paths.
-   Do not rename a route casually. Bookmarks, emails, documentation,
    and tests depend on it. If a rename is necessary, keep a redirect
    from the old path to the new one.
-   Avoid redirect chains: one hop at most.
-   Send unknown paths to a single not-found page or one catch-all
    redirect.
-   Use typed route parameters so that renaming a parameter fails at
    compile time.
-   Keep user-visible view state (filters, sort, page) in search params
    rather than adding route segments.
-   Use the router's `<Link>` for internal navigation, not `<a href>`,
    so the page does not fully reload.
-   Configure the single-page-app fallback (`/* → /index.html`) in one
    place on the host.

``` ts
// shared/api/http.ts — the only place that knows the base URL
const base = config.apiBaseUrl.replace(/\/+$/, '')

export const http = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>('GET', `${base}${path}`, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', `${base}${path}`, { ...options, body }),
}

// features/orders/api.ts — paths relative to the base, defined once
export const ordersApi = {
  list: (signal?: AbortSignal) => http.get<OrderResponse[]>('/orders', { signal }),
  cancel: (id: string, signal?: AbortSignal) =>
    http.post<OrderResponse>(`/orders/${encodeURIComponent(id)}/cancel`, {}, { signal }),
}

// app/routes.ts — one table for every page path
export const routes = {
  orders: '/orders',
  order: (id: string) => `/orders/${encodeURIComponent(id)}`,
} as const
```

``` ts
// Avoid: the prefix is added, removed, or guessed in several places
const url = path.startsWith('/api') ? path.slice(4) : path
fetch(`${BASE}${url}`)
fetch('/api/orders/' + id + '?q=' + query)
```

------------------------------------------------------------------------

## 14. Testing standards

Use a balanced test strategy. Test behavior the user can observe, not
implementation details.

### Unit tests

Test pure helpers, reducers, selectors, and hooks with Vitest or Jest.

### Component tests

Render components with Testing Library. Query by role, label, and text,
as a user would:

``` tsx
await user.click(screen.getByRole('button', { name: /place order/i }))
expect(await screen.findByText(/order placed/i)).toBeInTheDocument()
```

### API mocking

Use a mock server (for example, MSW) or stubbed `fetch` so tests never
reach a real network.

### End-to-end tests

Cover critical journeys (sign-in, checkout, payment) against a real or
disposable backend with Playwright or Cypress.

### Testing guardrails

-   Test loading, empty, error, and success states.
-   Test permission-dependent UI for each role, while remembering that
    server tests prove authorization.
-   Avoid snapshot tests for large trees; they break often and assert
    little.
-   Do not assert on internal state, class names, or hook call counts
    when a user-visible assertion is possible.
-   Keep tests deterministic: control time, randomness, and network.
-   Do not chase 100% coverage at the expense of meaningful assertions.
-   Run tests in CI, not only on a developer's machine.

Useful tools: Vitest, Jest, Testing Library, user-event, MSW,
Playwright, axe-core.

------------------------------------------------------------------------

## 15. API consumption

-   Use **one** HTTP client module for the application.
-   Define each endpoint path once, relative to the base URL, in the API
    module of the feature that owns it (see Section 13).
-   Set explicit timeouts and pass abort signals.
-   Retry only safe, idempotent requests, with bounded backoff. Never
    automatically retry a payment or order submission without an
    idempotency key.
-   Handle each meaningful status code deliberately (401, 403, 404, 409,
    422, 423, 429, 5xx).
-   Keep API types in one place per feature, and update them in the same
    change that updates the contract.
-   Generate types from an OpenAPI schema where one exists.
-   Do not depend on fields the API does not document.
-   Plan for backward compatibility when the backend changes a contract
    that a deployed frontend still uses.

------------------------------------------------------------------------

## 16. Performance and resilience

-   **Code-split** by route. Lazy-load heavy, rarely used libraries
    (spreadsheet parsers, charting, editors) at the point of use.
-   Set a bundle-size budget and check it in CI.
-   Optimize images: correct size, modern formats, and `loading="lazy"`
    below the fold.
-   Virtualize long lists and tables.
-   Use `memo`, `useMemo`, and `useCallback` when profiling shows a
    benefit or to keep a value stable for a dependency, not by default.
-   Avoid request waterfalls. Fetch independent data in parallel, and
    start fetching at the route level.
-   Prevent refetch storms: debounce search input, and do not invalidate
    on every keystroke or row.
-   Use skeletons that match the final layout to reduce layout shift
    (see Section 9 for when and how).
-   Keep the app shell (navigation, header) mounted while content loads.
-   Handle offline and slow networks with clear messages and retry
    controls.

------------------------------------------------------------------------

## 17. Accessibility

Accessibility is a requirement, not a polish step. Target **WCAG 2.2
AA**.

-   Use semantic HTML first: `button` for actions, `a` for navigation,
    `label` for inputs, headings in order, and landmark elements.
-   Every interactive element must work with a keyboard, with a visible
    focus indicator.
-   Icon-only buttons need an accessible name (`aria-label`).
-   Dialogs must trap focus, close with Escape, and return focus to the
    trigger.
-   Use ARIA roles only when no native element fits (`tablist`,
    `progressbar`, live regions for toasts).
-   Associate error messages with their fields (`aria-describedby`) and
    announce form errors.
-   Meet colour-contrast ratios, and never use colour as the only
    signal.
-   Respect `prefers-reduced-motion` and user font-size settings.
-   Run automated checks (axe-core, eslint-plugin-jsx-a11y) and test key
    flows with a screen reader.

------------------------------------------------------------------------

## 18. Code review and pull request standards

Before opening a pull request, verify:

-   The change solves the stated requirement and avoids unrelated scope.
-   Names and file placement are consistent with the codebase.
-   State ownership and data flow are clear, with no duplicated source of
    truth.
-   No unnecessary abstraction, alias, or wrapper was introduced.
-   Loading, empty, error, and permission states are handled, with a
    skeleton that matches the final layout where content is loading.
-   URLs and paths are defined once and are not rewritten in several
    layers; route paths were not renamed without a redirect.
-   Slices and thunks follow Section 11: serializable state, one status
    field, duplicate and late-response protection, and a reset on
    sign-out.
-   Keyboard navigation and screen-reader labels work.
-   Responsive layouts work at phone, tablet, and desktop widths.
-   No secrets, tokens, or personal data are logged or bundled.
-   Bundle-size impact of new dependencies is understood.
-   Tests cover important behavior and pass locally.
-   Lint, typecheck, and formatting checks pass.
-   The PR description explains intent and design decisions, and
    includes screenshots or recordings for visible changes.

Keep pull requests focused and reviewable. Split unrelated changes.

------------------------------------------------------------------------

## 19. Static analysis, formatting, and CI

Automate standards wherever practical so that code quality does not
depend on memory.

| Tool | Purpose |
|---|---|
| TypeScript (`strict`) | Type checking |
| ESLint / oxlint | Correctness rules, React hooks rules, accessibility rules |
| Prettier | Formatting |
| Vitest / Jest | Unit and component tests |
| Playwright / Cypress | End-to-end tests |
| axe-core | Automated accessibility checks |
| Bundle analyzer / size-limit | Bundle budgets |
| `npm audit` / Dependabot / Renovate | Dependency vulnerabilities and updates |
| GitHub Actions / GitLab CI | CI pipelines |

A typical CI pipeline:

``` text
Commit / Pull Request
        |
        v
Install (locked dependencies: npm ci)
        |
        v
Format and lint checks
        |
        v
Type check
        |
        v
Unit and component tests
        |
        v
Build + bundle-size check
        |
        v
End-to-end and accessibility tests
        |
        v
Dependency and security scans
        |
        v
Deploy preview → staging → production
```

Configure quality gates to fail builds for agreed critical issues. Tune
rules to the team's stack and risk profile rather than blindly enabling
every possible rule.

------------------------------------------------------------------------

## 20. Production readiness checklist

Before releasing, verify:

-   [ ] Configuration is externalized, validated, and contains no
    secrets.
-   [ ] Content-Security-Policy and security headers are set.
-   [ ] Session handling, sign-out, and cache clearing are tested.
-   [ ] Role-dependent screens are tested for each role.
-   [ ] Loading, empty, and error states exist for every data view.
-   [ ] The API base URL is a single environment value, and no path is
    rewritten across the client, proxy, host, and server.
-   [ ] Error tracking and source maps are configured.
-   [ ] Core Web Vitals are measured.
-   [ ] Bundle size is within budget; heavy libraries are lazy-loaded.
-   [ ] Accessibility checks pass for critical flows.
-   [ ] Single-page-app routing fallback is configured on the host.
-   [ ] Static assets use cache-busting file names and long cache
    lifetimes; `index.html` is not cached long-term.
-   [ ] Critical user journeys have end-to-end tests.
-   [ ] Rollback procedure for a bad deploy is documented.

------------------------------------------------------------------------

## 21. Practical rules to remember

1.  Prefer readable code over clever code.
2.  Keep components cohesive; do not enforce arbitrary line-count
    limits.
3.  Extract meaningful components and hooks, not trivial wrappers.
4.  Reuse stable behavior only when real use cases justify it.
5.  Keep business rules out of JSX; put them in named functions.
6.  Give every piece of state exactly one owner.
7.  Use one state tool per kind of state; do not stack them.
8.  Treat API data as untrusted and type it explicitly.
9.  Hiding UI is not authorization.
10. Design loading, empty, error, and success states.
11. Never put secrets in the client bundle.
12. Clear cached data on sign-out.
13. Make every interaction keyboard- and screen-reader-accessible.
14. Code-split by route and lazy-load heavy libraries.
15. Test what the user sees, not implementation details.
16. Define every URL and path once; transform it at most once.
17. Keep slices serializable, with one status field, and let thunks call
    the shared HTTP client.
18. Show a skeleton only when there is no data yet, and make it match
    the final layout.
19. Follow the repository's established conventions unless there is a
    documented reason to change them.

------------------------------------------------------------------------

## 22. Recommended learning and reference material

-   [React documentation](https://react.dev/)
-   [React — Thinking in React](https://react.dev/learn/thinking-in-react)
-   [React — You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
-   [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
-   [Redux Style Guide](https://redux.js.org/style-guide/)
-   [TanStack Query documentation](https://tanstack.com/query/latest/docs)
-   [Testing Library — Guiding Principles](https://testing-library.com/docs/guiding-principles)
-   [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
-   [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
-   [web.dev — Core Web Vitals](https://web.dev/articles/vitals)
-   [The Twelve-Factor App](https://12factor.net/)

------------------------------------------------------------------------

## Final engineering standard

For every component, hook, state slice, and dependency, be able to
answer:

1.  What responsibility does it own?
2.  Why does it belong here?
3.  Who renders or depends on it?
4.  Where does its data come from, and who else owns that data?
5.  What does the user see while loading, when empty, and on failure?
6.  How is its behavior tested?
7.  Can every user, including keyboard and screen-reader users, use it?
8.  Does it expose sensitive data or rely on the client for
    authorization?
9.  Is this the simplest design that meets the actual requirement?

If those questions have clear answers, the code is more likely to remain
understandable and safe as the product and team grow.
