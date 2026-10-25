"""Explicit, documented FastAPI page endpoints."""
from fastapi import APIRouter, Request
from app.controllers.pages import read_page
from app.models import pages

router = APIRouter(prefix="/api", tags=["Pages"])

@router.get("/dashboard", response_model=pages.DashboardResponse)
def dashboard(request: Request):
    return read_page(request, "dashboard")

@router.get("/catalog", response_model=pages.CatalogResponse)
def catalog(request: Request):
    return read_page(request, "catalog")

@router.get("/orders", response_model=pages.OrdersResponse)
def orders(request: Request):
    return read_page(request, "orders")

@router.get("/deliveries", response_model=pages.DeliveriesResponse)
def deliveries(request: Request):
    return read_page(request, "deliveries")

@router.get("/payments", response_model=pages.PaymentsResponse)
def payments(request: Request):
    return read_page(request, "payments")

@router.get("/credit", response_model=pages.CreditResponse)
def credit(request: Request):
    return read_page(request, "credit")

@router.get("/inventory", response_model=pages.InventoryResponse)
def inventory(request: Request):
    return read_page(request, "inventory")

@router.get("/people", response_model=pages.PeopleResponse)
def people(request: Request):
    return read_page(request, "people")

@router.get("/pricing", response_model=pages.PricingResponse)
def pricing(request: Request):
    return read_page(request, "pricing")

@router.get("/activity", response_model=pages.ActivityResponse)
def activity(request: Request):
    return read_page(request, "activity")

@router.get("/business", response_model=pages.BusinessResponse)
def business(request: Request):
    return read_page(request, "business")

@router.get("/directory", response_model=pages.DirectoryResponse)
def directory(request: Request):
    return read_page(request, "directory")

@router.get("/notifications", response_model=pages.NotificationsResponse)
def notifications(request: Request):
    return read_page(request, "notifications")

@router.get("/shell", response_model=pages.ShellResponse)
def shell(request: Request):
    return read_page(request, "shell")

