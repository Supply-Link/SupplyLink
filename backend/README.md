# Backend architecture

The production server is FastAPI. `server.py` constructs the PostgreSQL store and licence verifier, starts Uvicorn, and optionally starts the local LDAP listener.

## MVC responsibilities

- `app/main.py`: application factory, middleware, exception handlers, router registration.
- `app/routes/`: authentication, page reads, commands, and legacy compatibility routes.
- `app/controllers/`: request validation, cookies, and delegation to application services.
- `app/services/portal.py`: session authentication, licence enforcement, role authorization, transactions, and command orchestration.
- `app/models/domain.py`: business rules and atomic mutations.
- `app/models/pages.py`: page permissions, required fields, and Pydantic response contracts.
- `app/models/page_data.py`: page-specific, role-scoped read projections.
- `app/models/store.py`, `relational_store.py`: persistence and transactions.
- `../frontend/src/screens/`: React views consuming JSON APIs.

The old `app/domain.py`, `store.py`, `relational_store.py`, and `controllers/http.py` are compatibility imports. They do not contain duplicate implementations. LDAP, licensing, and pharmacy helpers remain shared infrastructure/domain utilities.

Routers use FastAPI's [multi-file application pattern](https://fastapi.tiangolo.com/tutorial/bigger-applications/). Page responses have explicit models in `/openapi.json`; interactive documentation remains disabled as before.

## Page reads

All routes below are `GET /api/<name>`. They authenticate the session cookie, require a usable licence, and derive the role from the session, never from client parameters. Every response includes the current safe `user` plus only the listed page collections.

| Page/API | Allowed roles | Data |
| --- | --- | --- |
| `dashboard` | All | Products, orders, delivery users |
| `catalog` | Retailer | Active products; batch purchase prices removed |
| `orders` | Admin, distributor, retailer | Visible orders and delivery users |
| `deliveries` | Admin, distributor, delivery | Visible orders and delivery users |
| `payments` | All | Visible orders, associated payments, delivery users |
| `credit` | Admin, retailer | Authorized retailer accounts |
| `inventory` | Admin, distributor | Authorized products and distributor accounts |
| `people` | Admin | User accounts |
| `pricing` | Admin | Pricing configuration |
| `activity` | Admin | Latest 80 audit events |
| `business` | Admin, distributor, retailer | Authorized business profiles |
| `directory` | Admin | User accounts and LDAP connection details |
| `notifications` | All | Current user's notifications |
| `shell` | All | Current user's unread notification count |

Unauthorized sessions return 401, disallowed page roles return 403, and unusable licences return 423. Distributor reads are restricted to owned products/orders; retailers see their own orders/payments; delivery users see assigned orders/payments. Existing command endpoints continue enforcing role, ownership, CSRF, and idempotency rules.

`GET /api/state` remains deprecated but functional for mobile compatibility. New web reads do not call it or construct its full snapshot. The PostgreSQL adapter still opens the existing aggregate transaction and loads the normalized data dictionary; this change reduces response payload and projection work, not the database transaction's read scope. Table-specific repository queries can be introduced separately without changing page contracts.

## Run and test

Install `requirements.txt` in a virtual environment, set `DATABASE_URL` in `backend/.env`, then run `python server.py --no-ldap`. Database credentials are backend-only. No database migration is required for the page API change.

```sh
python -m unittest discover -s tests -p 'test_fastapi.py'
python -m unittest discover -s tests -p 'test_pages.py'
python -m unittest discover -s tests
```

FastAPI/page contract tests use an isolated memory store. Legacy tests use temporary JSON files and require OpenSSL for licence fixtures. The JSON test adapter supports POSIX file locks and Windows byte-range locks.
