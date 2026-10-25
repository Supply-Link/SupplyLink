"""FastAPI controllers; API paths and JSON shapes remain stable for all clients."""
import json
import os
from urllib.parse import urlsplit

from fastapi import APIRouter, FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool

from app.domain import Problem, require


def allowed_origins():
    return {item.strip().rstrip('/') for item in os.environ.get('CORS_ORIGINS', '').split(',') if item.strip()}


def same_origin(request):
    origin = request.headers.get('origin')
    if origin:
        parsed = urlsplit(origin)
        require(parsed.scheme in ('http', 'https') and parsed.netloc and parsed.path in ('', '/') and
                not parsed.username and not parsed.password, 'Cross-origin request rejected.', 403)
        if origin.rstrip('/') not in allowed_origins():
            require(parsed.netloc == request.headers.get('host'), 'Cross-origin request rejected.', 403)
    require(request.headers.get('sec-fetch-site') != 'cross-site', 'Cross-site request rejected.', 403)


async def json_body(request):
    length = request.headers.get('content-length')
    if length is not None:
        try:
            require(int(length) <= 65536, 'JSON body is required and must be below 64 KB.', 413)
        except ValueError:
            raise Problem('Invalid body length.')
    raw = await request.body()
    require(0 < len(raw) <= 65536, 'JSON body is required and must be below 64 KB.', 413)
    require(request.headers.get('content-type', '').split(';')[0] == 'application/json', 'Use application/json.', 415)
    try:
        value = json.loads(raw, parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
    except (ValueError, UnicodeDecodeError):
        raise Problem('Invalid JSON.')
    require(isinstance(value, dict), 'Request body must be an object.')
    return value


def session_cookie(token='', clear=False):
    max_age = '0' if clear else '43200'
    if allowed_origins():
        extra = '; Secure; SameSite=None; Partitioned'
    else:
        extra = '; SameSite=Strict'
        if os.environ.get('COOKIE_SECURE') == '1':
            extra += '; Secure'
    return 'supplylink_session=%s; HttpOnly%s; Path=/; Max-Age=%s' % (token, extra, max_age)


def service(request):
    return request.app.state.portal


auth = APIRouter(prefix='/api')
workspace = APIRouter(prefix='/api')
commands = APIRouter(prefix='/api')


@auth.get('/license')
def license_status(request: Request):
    return service(request).license()


@auth.get('/health')
def health(request: Request):
    return service(request).health()


@auth.get('/me')
def me(request: Request):
    return service(request).me(request.cookies.get('supplylink_session'))


@workspace.get('/state')
def state(request: Request):
    return service(request).state(request.cookies.get('supplylink_session'))


COMMAND_PATHS = (
    '/login', '/logout', '/register', '/quote', '/orders', '/payments', '/proof-of-delivery',
    '/returns', '/tracking', '/users', '/registrations/approve', '/registrations/reject',
    '/products', '/batches', '/inventory', '/batches/quarantine', '/pricing', '/business',
    '/notifications/read',
)


async def command(request: Request):
    same_origin(request)
    path = request.url.path
    if path not in ('/api/login', '/api/logout'):
        service(request).require_license()
    body = await json_body(request)
    result = await run_in_threadpool(
        service(request).command, path, body, request.cookies.get('supplylink_session'),
        request.headers.get('x-csrf-token', ''), request.headers.get('idempotency-key'),
        request.client.host if request.client else 'unknown',
    )
    result = dict(result)
    token = result.pop('_session_token', None)
    clear = result.pop('_clear_cookie', False)
    response = JSONResponse(result)
    if token or clear:
        response.headers['Set-Cookie'] = session_cookie(token or '', clear)
    return response


for command_path in COMMAND_PATHS:
    commands.add_api_route(command_path, command, methods=['POST'], name='command_' + command_path.strip('/').replace('/', '_'))
commands.add_api_route('/orders/{order_id}', command, methods=['POST'], name='command_order_detail')


def create_app(portal_service):
    app = FastAPI(title='SupplyLink API', version='2.0.0', docs_url=None, redoc_url=None)
    app.state.portal = portal_service
    origins = sorted(allowed_origins())
    if origins:
        app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True,
                           allow_methods=['GET', 'POST', 'OPTIONS'],
                           allow_headers=['Content-Type', 'X-CSRF-Token', 'Idempotency-Key'])

    @app.exception_handler(Problem)
    async def problem_handler(_request, error):
        payload = dict(error=error.message)
        if hasattr(error, 'license_status'):
            payload.update(code='SOFTWARE_LICENSE_BLOCKED', license=error.license_status)
        return JSONResponse(payload, status_code=error.status)

    @app.exception_handler(Exception)
    async def unexpected_handler(request, error):
        # Do not expose database errors or credentials to web/mobile clients.
        import logging
        logging.getLogger('supplylink.api').exception('Unexpected API failure')
        message = 'Could not read data. Check the server log.' if request.method == 'GET' else 'Could not save changes. No changes were committed.'
        return JSONResponse(dict(error=message), status_code=500)

    @app.middleware('http')
    async def security_headers(request, call_next):
        response = await call_next(request)
        response.headers['Cache-Control'] = 'no-store'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Referrer-Policy'] = 'same-origin'
        response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
        return response

    app.include_router(auth)
    app.include_router(workspace)
    app.include_router(commands)
    return app
