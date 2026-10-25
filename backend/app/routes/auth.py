from fastapi import APIRouter, Request
from app.controllers.dependencies import service

router = APIRouter(prefix="/api", tags=["Authentication"])

@router.get('/license')
def license_status(request: Request):
    return service(request).license()


@router.get('/health')
def health(request: Request):
    return service(request).health()


@router.get('/me')
def me(request: Request):
    return service(request).me(request.cookies.get('supplylink_session'))


