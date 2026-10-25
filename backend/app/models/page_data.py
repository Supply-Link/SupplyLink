"""Role-scoped page projections; only prepare the collections the page consumes."""
import copy
from app.models.domain import safe_user, visible_orders
from app.auth.directory import user_dn
from app.domain.pharmacy import stock_summary, batch_status
from app.models.pages import PAGE_FIELDS


def page_data(data, user, page, ldap_url=None):
    fields = PAGE_FIELDS[page]
    result = {'user': safe_user(user)}
    orders = visible_orders(data, user) if any(f in fields for f in ('orders', 'payments', 'users')) else []
    if 'orders' in fields:
        result['orders'] = orders
    if 'users' in fields:
        people = data['users'] if user['role'] == 'admin' else [u for u in data['users'] if u['id'] == user['id'] or (user['role'] == 'distributor' and (u['role'] == 'delivery' or any(o['retailer_id'] == u['id'] for o in orders)))]
        if page == 'credit':
            people = [u for u in people if u['role'] == 'retailer']
        elif page == 'inventory':
            people = [u for u in people if u['role'] == 'distributor']
        elif page == 'business':
            people = [u for u in people if u['role'] != 'delivery' and (user['role'] == 'admin' or u['id'] == user['id'])]
        elif page in ('dashboard', 'orders', 'deliveries', 'payments'):
            people = [u for u in people if u['role'] == 'delivery']
        result['users'] = [safe_user(u) for u in people]
    if 'products' in fields:
        products = data['products']
        if user['role'] == 'distributor':
            products = [p for p in products if p['distributor_id'] == user['id']]
        elif user['role'] == 'retailer':
            products = [p for p in products if p['active']]
        elif user['role'] == 'delivery':
            products = []
        products = copy.deepcopy(products)
        for product in products:
            product.update(stock_summary(product))
            for batch in product.get('batches', []):
                batch['status'] = batch_status(batch)
                if user['role'] == 'retailer':
                    batch.pop('purchase_price', None)
        result['products'] = products
    if 'payments' in fields:
        order_ids = {o['id'] for o in orders}
        result['payments'] = [p for p in data['payments'] if p['order_id'] in order_ids]
    if 'notifications' in fields:
        result['notifications'] = [n for n in data['notifications'] if n['user_id'] == user['id']]
    if 'unread_notifications' in fields:
        result['unread_notifications'] = sum(1 for n in data['notifications'] if n['user_id'] == user['id'] and not n['read'])
    if 'pricing' in fields:
        result['pricing'] = data['pricing']
    if 'audit' in fields:
        result['audit'] = data['audit'][-80:][::-1]
    if 'directory' in fields:
        result['directory'] = dict(base_dn='dc=supplylink,dc=local', bind_dn=user_dn(user), listener_enabled=bool(ldap_url), url=ldap_url)
    return result
