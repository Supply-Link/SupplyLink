"""Command controller: validate transport, delegate, and set session cookies."""
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
from .dependencies import same_origin, json_body, service, session_cookie

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


