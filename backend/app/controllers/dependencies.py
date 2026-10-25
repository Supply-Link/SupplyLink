"""Shared HTTP validation and application-service dependency."""
import json
import os
from urllib.parse import urlsplit
from app.models.domain import Problem, require

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


