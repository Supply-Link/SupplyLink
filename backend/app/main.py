"""FastAPI composition root; views are the separate React frontend."""
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.models.domain import Problem
from app.controllers.dependencies import allowed_origins
from app.routes.auth import router as auth
from app.routes.commands import commands
from app.routes.legacy import workspace
from app.routes.pages import router as pages

def create_app(portal_service):
    app = FastAPI(title='SupplyLink API', version='3.0.0', docs_url=None, redoc_url=None)
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
    app.include_router(pages)
    return app
