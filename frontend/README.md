# SupplyLink web frontend

React, TypeScript, Vite, and Redux Toolkit. Configure `.env` from `.env.example`; `/api` is proxied to the backend. Run `npm install` and `npm run dev`.

## Screen organization

Each route has its own `src/screens/<Name>Screen.tsx` file: Dashboard, Catalog, Orders, Deliveries, Payments, Credit, Inventory, People, Pricing, Activity, Business, Directory, Notifications, Login, Register, and LicenseLock. `App.tsx` imports workspace screens individually for lazy loading; authentication screens are eagerly loaded.

Shared and page-specific dialogs live under `components/orders/`, `components/catalog/`, `components/people/`, and `components/inventory/`. The login and registration illustration is shared through `components/auth/AuthStory.tsx`. Screens retain their existing page slices and API contracts.

## Page data flow

1. `App.tsx` applies authentication, licence, and role guards before mounting a page.
2. `PageDataBoundary` selects the page's independent Redux state and dispatches its loader.
3. `state/pages/<page>Slice.ts` defines and dispatches its own request (`GET /api/<page>`) using the shared `lib/http.ts` transport.
4. The page renders only after its required data exists; `usePageData` exposes its typed payload to the view and dialogs.
5. Loading/error UI stays inside the persistent shell. Background refreshes retain visible data; failed refreshes expose a retry control.

There are individual slices for dashboard, catalog, orders, deliveries, payments, credit, inventory, people, pricing, activity, business, directory, and notifications. The shell has a separate lightweight unread-count slice. Authentication is in `state/pages/authSlice.ts`; command thunks live in their owning page slices. Shared domain types are in `src/types.ts`, and page response types are in `state/pages/types.ts`. There is no separate API folder. React Query manages mutation lifecycles and cart quotes, not page data.

`createPageSlice.ts` shares request deduplication, request-ID protection, and cache reset logic. Logout, sign-in, and licence locks clear page caches and ignore old responses. Screens and dialogs dispatch their slice thunks directly through `useAppDispatch`; the shared `state/actions.ts` facade has been removed. `createPageMutation.ts` invalidates dependent pages after successful commands, using dependencies declared in each mutation?s slice. Inactive pages refetch on their next visit; mounted pages refetch immediately. Periodic licence/focus checks mark ready pages stale without interrupting pending requests.

The last server-verified role is retained in `sessionStorage` for sidebar display during a refresh. Authentication, CSRF tokens, licence status, and page data are not persisted. Protected content still waits for session verification; logout or an invalid session clears the cached role.

The web application does not fetch `/api/state`. The backend keeps that endpoint only for older clients. Role-aware API contracts are documented in [the backend README](../backend/README.md).

Excel parsing is dynamically imported only when an inventory file is selected. Route module downloads and page data loads use layout-specific content skeletons.

## Checks

```sh
npm run build
npm run lint
npm test
```

Tests cover page API selection, independent caches, invalidation, late-response protection, and persistent navigation during loading.
