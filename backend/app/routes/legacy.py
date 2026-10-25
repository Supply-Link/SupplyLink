"""Compatibility endpoint for the existing mobile clients."""
from fastapi import APIRouter, Request
from app.controllers.dependencies import service

workspace = APIRouter(prefix="/api", tags=["Legacy"], deprecated=True)
@workspace.get('/state')
def state(request: Request):
    return service(request).state(request.cookies.get('supplylink_session'))


