"""Batch availability and the version-two file schema. Dates use Indian business time."""
from datetime import date, datetime, timedelta, timezone

INDIA = timezone(timedelta(hours=5, minutes=30))
STATE_CODES = {'01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','26','27','29','30','31','32','33','34','35','36','37','38'}


def today():
    return datetime.now(INDIA).date()


def batch_status(batch, on=None):
    on = on or today()
    if date.fromisoformat(batch['expiry_date']) < on:
        return 'expired'
    if batch.get('quarantined', False):
        return 'quarantined'
    if batch['stock'] == 0:
        return 'exhausted'
    if date.fromisoformat(batch['expiry_date']) <= on + timedelta(days=90):
        return 'near_expiry'
    return 'available'


def stock_summary(product):
    if 'batches' not in product:
        return dict(stock=product['stock'], total_stock=product['stock'], expired_stock=0, near_expiry_stock=0, quarantined_stock=0, next_expiry=None)
    batches = product['batches']
    valid = [b for b in batches if batch_status(b) in ('available', 'near_expiry')]
    return dict(stock=sum(b['stock'] for b in valid), total_stock=sum(b['stock'] for b in batches),
                expired_stock=sum(b['stock'] for b in batches if batch_status(b) == 'expired'),
                near_expiry_stock=sum(b['stock'] for b in batches if batch_status(b) == 'near_expiry'),
                quarantined_stock=sum(b['stock'] for b in batches if batch_status(b) == 'quarantined'),
                next_expiry=min((b['expiry_date'] for b in valid), default=None))


def sync_stock(product):
    product['stock'] = stock_summary(product)['stock']


def demo_batch(product):
    current = today()
    number = product['sku'].replace('MED-', '')
    return dict(id='batch-demo-'+product['id'], batch_number='DEMO-'+number+'-01',
                manufacturing_date=(current-timedelta(days=90)).isoformat(),
                expiry_date=(current+timedelta(days=60 if product['id']=='med04' else 540)).isoformat(),
                stock=product['stock'], mrp=product['price']*3//2,
                purchase_price=product['price']*4//5, quarantined=False, demo=True)


def pharmacy_defaults(product, sample=False):
    product.setdefault('manufacturer', 'Demo manufacturer — replace before use' if sample else '')
    product.setdefault('hsn_code', '3004' if sample else '')
    product.setdefault('gst_rate_bps', 500 if sample else None)
    product.setdefault('storage_conditions', 'Follow the manufacturer label')
    if 'batches' not in product:
        product['batches'] = [demo_batch(product)] if sample else []
        if not sample and product.get('stock', 0):
            product['unallocated_stock'] = product['stock']
        sync_stock(product)


def migrate(data):
    """Keep order snapshots untouched. Only seed records receive sample batch facts."""
    for product in data['products']:
        if product.get('generic_name'):
            pharmacy_defaults(product, sample=product.get('demo', False))
    for user in data['users']:
        if user['role'] in ('distributor', 'retailer', 'admin'):
            user.setdefault('gstin', '')
            user.setdefault('state_code', '29')
            user.setdefault('legal_name', user['business'])
            user.setdefault('drug_license', '')
            user.setdefault('address', 'Bengaluru, Karnataka (demo)' if user['id']=='distributor' else '')
    for user in data['users']:
        user.setdefault('approval_status', 'approved')
    data['version'] = 3
