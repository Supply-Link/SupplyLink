"""Page contracts and role policy. Never accept a role from the client."""
from typing import Any
from pydantic import BaseModel, ConfigDict

PAGE_ROLES = {'dashboard': ('admin', 'distributor', 'retailer', 'delivery'),
 'catalog': ('retailer',),
 'orders': ('admin', 'distributor', 'retailer'),
 'deliveries': ('admin', 'distributor', 'delivery'),
 'payments': ('distributor',),
 'credit': ('admin', 'retailer'),
 'inventory': ('admin', 'distributor'),
 'people': ('admin',),
 'pricing': ('admin',),
 'activity': ('admin',),
 'business': ('admin', 'distributor', 'retailer'),
 'directory': ('admin',),
 'notifications': ('admin', 'distributor', 'retailer', 'delivery'),
 'shell': ('admin', 'distributor', 'retailer', 'delivery')}
PAGE_FIELDS = {'dashboard': ('products', 'orders', 'users'),
 'catalog': ('products',),
 'orders': ('orders', 'users'),
 'deliveries': ('orders', 'users'),
 'payments': ('orders', 'users', 'payments'),
 'credit': ('users',),
 'inventory': ('products', 'users'),
 'people': ('users',),
 'pricing': ('pricing',),
 'activity': ('audit',),
 'business': ('users',),
 'directory': ('users', 'directory'),
 'notifications': ('notifications',),
 'shell': ('unread_notifications',)}

class PageResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    user: dict[str, Any]

class DashboardResponse(PageResponse):
    products: list[dict[str, Any]]
    orders: list[dict[str, Any]]
    users: list[dict[str, Any]]

class CatalogResponse(PageResponse):
    products: list[dict[str, Any]]

class OrdersResponse(PageResponse):
    orders: list[dict[str, Any]]
    users: list[dict[str, Any]]

class DeliveriesResponse(PageResponse):
    orders: list[dict[str, Any]]
    users: list[dict[str, Any]]

class PaymentsResponse(PageResponse):
    orders: list[dict[str, Any]]
    users: list[dict[str, Any]]
    payments: list[dict[str, Any]]

class CreditResponse(PageResponse):
    users: list[dict[str, Any]]

class InventoryResponse(PageResponse):
    products: list[dict[str, Any]]
    users: list[dict[str, Any]]

class PeopleResponse(PageResponse):
    users: list[dict[str, Any]]

class PricingResponse(PageResponse):
    pricing: dict[str, Any]

class ActivityResponse(PageResponse):
    audit: list[dict[str, Any]]

class BusinessResponse(PageResponse):
    users: list[dict[str, Any]]

class DirectoryResponse(PageResponse):
    users: list[dict[str, Any]]
    directory: dict[str, Any]

class NotificationsResponse(PageResponse):
    notifications: list[dict[str, Any]]

class ShellResponse(PageResponse):
    unread_notifications: int

