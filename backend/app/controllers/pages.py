"""Read controller; authorization and projection are application/model concerns."""
from fastapi import Request
from app.controllers.dependencies import service


def read_page(request: Request, page: str):
    return service(request).page(request.cookies.get('supplylink_session'), page)
