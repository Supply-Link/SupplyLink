"""Role checks and atomic business operations. All money is integer paise."""
import secrets
import re
import copy
from datetime import date
from app.domain.pharmacy import today, batch_status, stock_summary, sync_stock, STATE_CODES
from .store import now, password_hash
from app.auth.directory import user_dn


class Problem(Exception):
    def __init__(self, message, status=400):
        self.message, self.status = message, status


def require(condition, message, status=400):
    if not condition:
        raise Problem(message, status)


def integer(value, name, minimum=0, maximum=100000000):
    require(isinstance(value, int) and not isinstance(value, bool) and minimum <= value <= maximum,
            '%s must be an integer between %s and %s.' % (name, minimum, maximum))
    return value


def text(value, name, limit=300):
    require(isinstance(value, str) and 0 < len(value.strip()) <= limit, '%s is required (maximum %s characters).' % (name, limit))
    return value.strip()


def uid(prefix):
    return prefix + '-' + secrets.token_hex(5)


def find(rows, key, value):
    found = next((r for r in rows if r.get(key) == value), None)
    require(found is not None, 'Record not found.', 404)
    return found


def role(user, *roles):
    require(user['role'] in roles, 'Your role cannot perform this action.', 403)


def safe_user(user):
    return {k: v for k, v in user.items() if k != 'password'}


def audit(data, user, action, detail):
    data['audit'].append(dict(id=uid('evt'), actor=user['id'], name=user['name'], action=action, detail=detail, at=now()))


def notify(data, user_id, title, body):
    data['notifications'].append(dict(id=uid('note'), user_id=user_id, title=title, body=body, at=now(), read=False))


def visible_orders(data, user):
    if user['role'] == 'admin':
        return data['orders']
    field = {'retailer':'retailer_id', 'distributor':'distributor_id', 'delivery':'driver_id'}[user['role']]
    return [o for o in data['orders'] if o.get(field) == user['id']]


def get_order(data, user, order_id):
    order = find(data['orders'], 'id', order_id)
    require(any(o['id'] == order_id for o in visible_orders(data, user)), 'You cannot access this order.', 403)
    return order


def valid_date(value, name):
    require(isinstance(value, str), name + ' is required (YYYY-MM-DD).')
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        raise Problem(name + ' must be a valid date (YYYY-MM-DD).')
    require(parsed.isoformat() == value, name + ' must use YYYY-MM-DD.')
    return parsed


def state_code(value):
    require(isinstance(value, str) and value in STATE_CODES, 'Select a valid Indian state / territory code.')
    return value


def tax_fields(body, product):
    if 'manufacturer' in body:
        product['manufacturer'] = text(body['manufacturer'], 'Manufacturer', 150)
    if 'storage_conditions' in body:
        product['storage_conditions'] = text(body['storage_conditions'], 'Storage conditions', 300)
    if 'hsn_code' in body:
        code = body['hsn_code']
        require(isinstance(code, str) and re.fullmatch(r'(?:[0-9]{4}|[0-9]{6}|[0-9]{8})', code), 'HSN must contain 4, 6, or 8 digits.')
        product['hsn_code'] = code
    if 'gst_rate_bps' in body:
        product['gst_rate_bps'] = integer(body['gst_rate_bps'], 'GST rate (basis points)', 0, 4000)


def new_batch(product, body):
    number = text(body.get('batch_number'), 'Batch ID / lot number', 60)
    require(not any(b['batch_number'].casefold() == number.casefold() for b in product.get('batches', [])), 'Batch ID already exists for this medicine.', 409)
    manufactured = valid_date(body.get('manufacturing_date'), 'Manufacturing date')
    expires = valid_date(body.get('expiry_date'), 'Expiry date')
    require(manufactured <= today(), 'Manufacturing date cannot be in the future.')
    require(expires > manufactured, 'Expiry date must be after the manufacturing date.')
    mrp = integer(body.get('mrp'), 'MRP including GST', 1)
    cost = integer(body.get('purchase_price', 0), 'Purchase price excluding GST')
    require(cost <= mrp, 'Purchase price cannot exceed MRP.')
    rate = product.get('gst_rate_bps')
    require(rate is not None, 'Configure the medicine GST rate first.')
    require(product['price'] * (10000 + rate) <= mrp * 10000, 'MRP must cover the selling price including GST.')
    batch = dict(id=uid('batch'), batch_number=number, manufacturing_date=manufactured.isoformat(), expiry_date=expires.isoformat(),
                 stock=integer(body.get('stock'), 'Opening batch stock'), mrp=mrp, purchase_price=cost, quarantined=False)
    if body.get('source') == 'unallocated':
        require(batch['stock'] <= product.get('unallocated_stock',0), 'Quantity exceeds the historical stock awaiting batch details.', 409)
        product['unallocated_stock'] -= batch['stock']
    product.setdefault('batches', []).append(batch)
    sync_stock(product)
    return batch


def quote(data, items, supply_state_code='29'):
    require(isinstance(items, list) and 0 < len(items) <= 100, 'Add between 1 and 100 products.')
    destination = state_code(supply_state_code)
    lines, seen = [], set()
    distributor = None
    supplier = None
    for item in items:
        require(isinstance(item, dict), 'Invalid order line.')
        p = find(data['products'], 'id', item.get('product_id'))
        require(p['active'], 'This medicine is unavailable.')
        require(p['id'] not in seen, 'Combine duplicate medicines into one line.')
        seen.add(p['id'])
        quantity = integer(item.get('quantity'), 'Quantity', 1, 10000)
        sync_stock(p)
        require(quantity <= p['stock'], '%s has only %s unexpired packs available.' % (p['name'], p['stock']), 409)
        require(p.get('hsn_code') and p.get('gst_rate_bps') is not None, 'Configure HSN and GST for ' + p['name'] + ' before ordering.', 409)
        if distributor is None:
            distributor = p['distributor_id']
            supplier = find(data['users'], 'id', distributor)
            require(supplier['active'], 'This distributor is inactive.', 409)
            state_code(supplier.get('state_code'))
        require(distributor == p['distributor_id'], 'Place a separate order for each distributor.')
        discount = data['pricing']['bulk_discount_bps'] if quantity >= data['pricing']['bulk_min'] else 0
        subtotal = p['price'] * quantity
        reduction = subtotal * discount // 10000
        taxable = subtotal - reduction
        rate = p['gst_rate_bps']
        intra = supplier['state_code'] == destination
        cgst = (taxable * rate + 10000) // 20000 if intra else 0
        utgst = cgst if intra and destination in {'04','26','31','35','38'} else 0
        sgst = cgst if intra and not utgst else 0
        igst = 0 if intra else (taxable * rate + 5000) // 10000
        remaining, allocations = quantity, []
        for batch in sorted(p.get('batches', []), key=lambda b: (b['expiry_date'], b['manufacturing_date'], b['id'])):
            if batch_status(batch) not in ('available', 'near_expiry'):
                continue
            take = min(remaining, batch['stock'])
            if take:
                require(p['price'] * (10000 + rate) <= batch['mrp'] * 10000, 'Selling price including GST exceeds MRP for batch ' + batch['batch_number'] + '.', 409)
                allocations.append(dict(batch_id=batch['id'], batch_number=batch['batch_number'], manufacturing_date=batch['manufacturing_date'], expiry_date=batch['expiry_date'], mrp=batch['mrp'], quantity=take))
                remaining -= take
            if remaining == 0:
                break
        require(remaining == 0, 'Receive batch stock before ordering this medicine.', 409)
        tax = cgst + sgst + utgst + igst
        lines.append(dict(product_id=p['id'], name=p['name'], unit=p['unit'], manufacturer=p.get('manufacturer', ''), quantity=quantity, unit_price=p['price'],
                          subtotal=subtotal, discount=reduction, taxable=taxable, hsn_code=p['hsn_code'], gst_rate_bps=rate, cgst=cgst, sgst=sgst, utgst=utgst, igst=igst,
                          tax=tax, total=taxable+tax, batches=allocations))
    result = {field: sum(line[field] for line in lines) for field in ('subtotal','discount','taxable','cgst','sgst','utgst','igst','tax','total')}
    result.update(lines=lines, distributor_id=distributor, supply_state_code=destination, supplier_state_code=supplier['state_code'], tax_type=('CGST + UTGST' if destination in {'04','26','31','35','38'} else 'CGST + SGST') if supplier['state_code']==destination else 'IGST')
    return result


def business_snapshot(user):
    return {k: user.get(k, '') for k in ('id','business','legal_name','address','gstin','state_code','drug_license')}


def create_order(data, user, body, key):
    role(user, 'retailer')
    require(isinstance(key, str) and 8 <= len(key) <= 120, 'An idempotency key is required.')
    existing = next((o for o in data['orders'] if o['retailer_id'] == user['id'] and o['request_key'] == key), None)
    if existing:
        return existing
    calculated = quote(data, body.get('items'), body.get('supply_state_code', user.get('state_code', '29')))
    if 'expected_total' in body:
        require(body['expected_total'] == calculated['total'], 'The order total has changed. Reopen your basket to review current prices and GST.', 409)
    address = text(body.get('address', user.get('address')), 'Delivery address', 500)
    method = body.get('payment_method', 'cod')
    require(method in ('cod', 'credit'), 'Choose cash on delivery or trade credit.')
    if method == 'credit':
        require(calculated['total'] <= user['credit_limit'] - user['credit_used'], 'Insufficient trade credit.', 409)
        user['credit_used'] += calculated['total']
    for line in calculated['lines']:
        product = find(data['products'], 'id', line['product_id'])
        for allocation in line['batches']:
            find(product['batches'], 'id', allocation['batch_id'])['stock'] -= allocation['quantity']
        sync_stock(product)
    order = dict(id=uid('ord'), number='SL-%05d' % (len(data['orders']) + 1001), retailer_id=user['id'], retailer_name=user['business'], distributor_id=calculated.pop('distributor_id'), driver_id=None, address=address, payment_method=method, payment_status='unpaid', status='placed', created_at=now(), request_key=key, history=[dict(status='placed', at=now(), by=user['name'])], tracking=[], **calculated)
    order['supplier'] = business_snapshot(find(data['users'], 'id', order['distributor_id']))
    order['buyer'] = business_snapshot(user)
    data['orders'].append(order)
    notify(data, order['distributor_id'], 'New order ' + order['number'], user['business'] + ' placed an order.')
    audit(data, user, 'Order placed', order['number'])
    return order


def update_order(data, user, order_id, body):
    order = get_order(data, user, order_id)
    target = body.get('status')
    current = order['status']
    if target == 'cancelled':
        role(user, 'admin', 'retailer', 'distributor')
        require(current in ('placed', 'confirmed') or (current == 'packed' and user['role'] in ('admin','distributor')), 'This order can no longer be cancelled by your role.', 409)
        require(order['payment_status'] == 'unpaid', 'Paid orders require a refund workflow and cannot be cancelled here.', 409)
        for line in order['lines']:
            product = find(data['products'], 'id', line['product_id'])
            if line.get('batches'):
                for allocation in line['batches']:
                    find(product['batches'], 'id', allocation['batch_id'])['stock'] += allocation['quantity']
                sync_stock(product)
            elif 'batches' in product:
                product['unallocated_stock'] = product.get('unallocated_stock', 0) + line['quantity']
                sync_stock(product)
            else:
                product['stock'] += line['quantity']
        if order['payment_method'] == 'credit':
            find(data['users'], 'id', order['retailer_id'])['credit_used'] -= order['total']
    else:
        transitions = {'placed':'confirmed', 'confirmed':'packed', 'packed':'out_for_delivery', 'out_for_delivery':'delivered'}
        require(transitions.get(current) == target, 'Invalid order status transition.', 409)
        if target == 'delivered':
            role(user, 'admin', 'delivery')
        else:
            role(user, 'admin', 'distributor')
        if target in ('confirmed','packed','out_for_delivery'):
            for line in order['lines']:
                for allocation in line.get('batches', []):
                    require(valid_date(allocation['expiry_date'], 'Batch expiry') >= today(), 'Reserved batch ' + allocation['batch_number'] + ' has expired. Cancel and replace this order.', 409)
                    product = find(data['products'], 'id', line['product_id'])
                    batch = find(product.get('batches', []), 'id', allocation['batch_id'])
                    require(batch_status(batch) != 'expired', 'Reserved batch ' + batch['batch_number'] + ' has expired.', 409)
                    require(not batch.get('quarantined'), 'Reserved batch ' + batch['batch_number'] + ' is quarantined.', 409)
        if target == 'out_for_delivery':
            driver = find(data['users'], 'id', body.get('driver_id'))
            require(driver['role'] == 'delivery' and driver['active'], 'Select an active delivery partner.')
            order['driver_id'] = driver['id']
            notify(data, driver['id'], 'Delivery assigned', order['number'] + ' is ready for pickup.')
    order['status'] = target
    order['history'].append(dict(status=target, at=now(), by=user['name']))
    notify(data, order['retailer_id'], order['number'] + ' updated', 'Your order is ' + target.replace('_', ' ') + '.')
    audit(data, user, 'Order ' + target.replace('_', ' '), order['number'])
    return order


def record_payment(data, user, body, key):
    role(user, 'admin', 'distributor', 'delivery')
    order = get_order(data, user, body.get('order_id'))
    require(isinstance(key, str) and 8 <= len(key) <= 120, 'An idempotency key is required.')
    existing = next((p for p in data['payments'] if p['actor_id'] == user['id'] and p['request_key'] == key), None)
    if existing:
        require(existing['order_id'] == order['id'], 'Payment key was already used for another order.', 409)
        return existing
    require(order['status'] != 'cancelled', 'Cannot pay a cancelled order.', 409)
    require(order['payment_status'] != 'paid', 'This order is already paid.', 409)
    require(order['status'] == 'delivered', 'Record collection after delivery.', 409)
    amount = integer(body.get('amount'), 'Amount', 1, 10**14)
    require(amount == order['total'], 'Record the full outstanding order amount.')
    reference = text(body.get('reference'), 'Receipt reference', 100)
    payment = dict(id=uid('pay'), order_id=order['id'], order_number=order['number'], amount=amount, reference=reference, actor_id=user['id'], request_key=key, at=now(), mode='manual')
    data['payments'].append(payment)
    order['payment_status'] = 'paid'
    if order['payment_method'] == 'credit':
        find(data['users'], 'id', order['retailer_id'])['credit_used'] -= amount
    notify(data, order['retailer_id'], 'Payment recorded', order['number'] + ': your offline payment has been recorded.')
    audit(data, user, 'Payment recorded', order['number'])
    return payment


def capture_proof(data, user, body, key):
    """Save a compact signature and complete the assigned delivery atomically."""
    role(user, 'delivery')
    order = get_order(data, user, body.get('order_id'))
    require(isinstance(key, str) and 8 <= len(key) <= 120, 'An idempotency key is required.')
    existing = order.get('proof_of_delivery')
    if existing:
        require(existing.get('request_key') == key, 'Proof of delivery is already recorded.', 409)
        return existing
    require(order['status'] == 'out_for_delivery', 'Proof requires an active delivery.', 409)
    recipient = text(body.get('recipient_name'), 'Recipient name', 100)
    strokes = body.get('signature')
    require(isinstance(strokes, list) and 1 <= len(strokes) <= 20, 'Draw a recipient signature.')
    point_count = 0
    for stroke in strokes:
        require(isinstance(stroke, list) and 2 <= len(stroke) <= 200, 'Signature stroke is invalid.')
        for point in stroke:
            require(isinstance(point, list) and len(point) == 2 and
                    all(isinstance(value, int) and not isinstance(value, bool) and 0 <= value <= 1000 for value in point),
                    'Signature coordinates are invalid.')
            point_count += 1
    require(4 <= point_count <= 1500, 'Draw a complete recipient signature.')
    proof = dict(recipient_name=recipient, signature=strokes, captured_at=now(), captured_by=user['id'], request_key=key)
    order['proof_of_delivery'] = proof
    update_order(data, user, order['id'], {'status': 'delivered'})
    audit(data, user, 'Proof of delivery recorded', order['number'])
    return proof


def manage_return(data, user, body, key):
    """Request or review a return. No stock or payment movement occurs here."""
    order = get_order(data, user, body.get('order_id'))
    action = body.get('action')
    if action == 'request':
        role(user, 'retailer')
        require(order['status'] == 'delivered', 'Request a return after delivery.', 409)
        require(isinstance(key, str) and 8 <= len(key) <= 120, 'An idempotency key is required.')
        existing = order.get('return_request')
        if existing:
            require(existing.get('request_key') == key, 'A return request already exists for this order.', 409)
            return existing
        result = dict(id=uid('ret'), order_id=order['id'], status='requested',
                      reason=text(body.get('reason'), 'Return reason', 500), requested_at=now(),
                      requested_by=user['id'], request_key=key)
        order['return_request'] = result
        notify(data, order['distributor_id'], 'Return requested', order['number'] + ': review the retailer request.')
        audit(data, user, 'Return requested', order['number'])
        return result
    require(action in ('approve', 'reject'), 'Choose a valid return action.')
    role(user, 'admin', 'distributor')
    result = order.get('return_request')
    require(result is not None, 'No return request exists.', 404)
    require(result['status'] == 'requested', 'This return request is already reviewed.', 409)
    result.update(status='approved' if action == 'approve' else 'rejected',
                  review_note=text(body.get('review_note'), 'Review note', 500),
                  reviewed_at=now(), reviewed_by=user['id'])
    notify(data, order['retailer_id'], 'Return request ' + result['status'], order['number'] + ': ' + result['review_note'])
    audit(data, user, 'Return request ' + result['status'], order['number'])
    return result


def snapshot(data, user):
    orders = visible_orders(data, user)
    order_ids = {o['id'] for o in orders}
    people = data['users'] if user['role'] == 'admin' else [u for u in data['users'] if u['id'] == user['id'] or (user['role'] == 'distributor' and (u['role'] == 'delivery' or any(o['retailer_id'] == u['id'] for o in orders)))]
    products = data['products']
    if user['role'] == 'distributor':
        products = [p for p in products if p['distributor_id'] == user['id']]
    if user['role'] == 'retailer':
        products = [p for p in products if p['active']]
    if user['role'] == 'delivery':
        products = []
    products = copy.deepcopy(products)
    for product in products:
        product.update(stock_summary(product))
        for batch in product.get('batches', []):
            batch['status'] = batch_status(batch)
            if user['role'] == 'retailer':
                batch.pop('purchase_price', None)
    suppliers = [business_snapshot(u) for u in data['users'] if u['role']=='distributor' and (user['role']=='admin' or any(p['distributor_id']==u['id'] for p in products) or any(o['distributor_id']==u['id'] for o in orders))]
    return dict(directory=dict(base_dn='dc=supplylink,dc=local', bind_dn=user_dn(user)), suppliers=suppliers, business_date=today().isoformat(), user=safe_user(user), users=[safe_user(u) for u in people], products=products, orders=orders, payments=[p for p in data['payments'] if p['order_id'] in order_ids], notifications=[n for n in data['notifications'] if n['user_id'] == user['id']], pricing=data['pricing'], audit=data['audit'][-80:][::-1] if user['role'] == 'admin' else [])


def register(data, body):
    requested = body.get('role')
    require(requested in ('retailer','distributor','delivery'), 'Registration is available for retailers, distributors, and delivery partners.')
    email = text(body.get('email'), 'Email', 150).lower()
    require(re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email), 'Enter a valid email address.')
    require(not any(u['email']==email for u in data['users']), 'An account or registration already exists for this email.', 409)
    password = text(body.get('password'), 'Password', 128)
    require(len(password)>=10, 'Password must contain at least 10 characters.')
    u = dict(id=uid('usr'), name=text(body.get('name'),'Full name',100), business=text(body.get('business'),'Business / team',100), email=email,
             password=password_hash(password), role=requested, requested_role=requested, active=False, approval_status='pending', registered_at=now(),
             address=text(body.get('address'),'Business / service address',500), state_code=state_code(body.get('state_code')), gstin='', drug_license='')
    gstin=body.get('gstin','')
    require(isinstance(gstin,str), 'Invalid GSTIN.')
    gstin=gstin.strip().upper()
    require(not gstin or (re.fullmatch(r'[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]',gstin) and gstin[:2]==u['state_code']), 'GSTIN format must match your state code.')
    license_number=body.get('drug_license','')
    require(isinstance(license_number,str) and len(license_number)<=100,'Invalid drug licence number.')
    u.update(legal_name=u['business'],gstin=gstin,drug_license=license_number.strip())
    if requested=='retailer': u.update(credit_limit=0,credit_used=0)
    data['users'].append(u)
    audit(data,u,'Registration submitted',requested+' access requested')
    for admin in data['users']:
        if admin['role']=='admin' and admin['active']:
            notify(data,admin['id'],'New access request',u['name']+' requested '+requested+' access.')
    return dict(ok=True, message='Registration submitted. An administrator must approve your access before you can sign in.')


def mutate(data, user, path, body, key):
    if path in ('/api/registrations/approve','/api/registrations/reject'):
        role(user, 'admin')
        target = find(data['users'],'id',body.get('user_id'))
        require(target.get('approval_status') in ('pending','rejected'), 'This account has already been reviewed.', 409)
        if path.endswith('/approve'):
            assigned = body.get('role',target.get('requested_role'))
            require(assigned in ('admin','retailer','distributor','delivery'), 'Select a valid access role.')
            target.update(role=assigned, active=True, approval_status='approved', reviewed_by=user['id'], reviewed_at=now())
            if assigned=='retailer':
                target.setdefault('credit_limit',0)
                target.setdefault('credit_used',0)
            notify(data,target['id'],'Your access is approved','Your '+assigned+' workspace is ready.')
        else:
            target.update(active=False, approval_status='rejected', review_reason=text(body.get('reason'),'Reason',300), reviewed_by=user['id'], reviewed_at=now())
        audit(data,user,'Registration '+target['approval_status'],target['email'])
        return safe_user(target)
    if path == '/api/orders':
        return create_order(data, user, body, key)
    if path.startswith('/api/orders/'):
        return update_order(data, user, path.split('/')[-1], body)
    if path == '/api/quote':
        role(user, 'retailer')
        return quote(data, body.get('items'), body.get('supply_state_code', user.get('state_code', '29')))
    if path == '/api/payments':
        return record_payment(data, user, body, key)
    if path == '/api/proof-of-delivery':
        return capture_proof(data, user, body, key)
    if path == '/api/returns':
        return manage_return(data, user, body, key)
    if path in ('/api/inventory', '/api/batches', '/api/batches/quarantine'):
        role(user, 'admin', 'distributor')
        p = find(data['products'], 'id', body.get('product_id'))
        require(user['role'] == 'admin' or p['distributor_id'] == user['id'], 'This medicine belongs to another distributor.', 403)
        if path == '/api/batches':
            batch = new_batch(p, body)
            audit(data, user, 'Batch received', p['sku'] + ': ' + batch['batch_number'])
            return batch
        batch = find(p.get('batches', []), 'id', body.get('batch_id'))
        reason = text(body.get('reason'), 'Adjustment reason')
        if path == '/api/batches/quarantine':
            require(isinstance(body.get('quarantined'), bool), 'Quarantine must be true or false.')
            batch['quarantined'] = body['quarantined']
            audit(data, user, 'Batch quarantine updated', batch['batch_number'] + ': ' + reason)
        else:
            change = integer(body.get('change'), 'Stock adjustment', -100000, 100000)
            require(batch['stock'] + change >= 0, 'Available batch stock cannot fall below zero.', 409)
            batch['stock'] += change
            audit(data, user, 'Batch stock adjusted', '%s / %s: %+d (%s)' % (p['sku'], batch['batch_number'], change, reason))
        sync_stock(p)
        return batch
    if path == '/api/business':
        role(user, 'admin', 'retailer', 'distributor')
        target = find(data['users'], 'id', body.get('user_id', user['id']))
        require(user['role']=='admin' or target['id']==user['id'], 'You cannot edit another business.', 403)
        require(target['role'] in ('retailer','distributor','admin'), 'This account has no business tax profile.')
        code = state_code(body.get('state_code'))
        gstin = body.get('gstin', '')
        require(isinstance(gstin, str), 'Invalid GSTIN.')
        gstin = gstin.strip().upper()
        require(not gstin or (re.fullmatch(r'[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]', gstin) and gstin[:2]==code), 'GSTIN must have a valid 15-character format and match the state code.')
        target.update(legal_name=text(body.get('legal_name'), 'Legal business name', 150), address=text(body.get('address'), 'Business address', 500), state_code=code, gstin=gstin)
        license_number = body.get('drug_license', '')
        require(isinstance(license_number, str) and len(license_number)<=100, 'Drug licence number must be at most 100 characters.')
        target['drug_license'] = license_number.strip()
        audit(data, user, 'Business tax profile updated', target['business'])
        return business_snapshot(target)
    if path == '/api/products':
        role(user, 'admin', 'distributor')
        if body.get('id'):
            p = find(data['products'], 'id', body['id'])
            require(user['role'] == 'admin' or p['distributor_id'] == user['id'], 'Product access denied.', 403)
            for field in ('name','brand','category','unit','generic_name','strength','dosage_form'):
                if field in body:
                    p[field] = text(body[field], field, 100)
            tax_fields(body, p)
            if 'price' in body:
                p['price'] = integer(body['price'], 'Price', 1)
            if 'reorder' in body:
                p['reorder'] = integer(body['reorder'], 'Reorder level')
            if 'active' in body:
                require(isinstance(body['active'], bool), 'Active must be true or false.')
                p['active'] = body['active']
        else:
            distributor = body.get('distributor_id') if user['role'] == 'admin' else user['id']
            d = find(data['users'], 'id', distributor)
            require(d['role'] == 'distributor' and d['active'], 'Select an active distributor.')
            sku = text(body.get('sku'), 'SKU', 40)
            require(not any(p['sku'].lower() == sku.lower() for p in data['products']), 'SKU already exists.', 409)
            p = dict(id=uid('p'), name=text(body.get('name'), 'Product name', 100), brand=text(body.get('brand'), 'Brand', 100), category=text(body.get('category'), 'Category', 100), sku=sku, unit=text(body.get('unit'), 'Unit', 100), price=integer(body.get('price'), 'Price', 1), stock=integer(body.get('stock',0), 'Stock'), reorder=integer(body.get('reorder',20), 'Reorder level'), art='tablets', color='#e5eee6', active=True, distributor_id=distributor)
            for field in ('generic_name', 'strength', 'dosage_form'):
                p[field] = text(body.get(field), field.replace('_', ' '), 100)
            p['art'] = {'Capsules':'capsules', 'Cream':'tube', 'MDI inhaler':'inhaler', 'Powder':'sachet', 'Topical solution':'bottle'}.get(p['dosage_form'], 'tablets')
            p['batches'] = []
            p['stock'] = 0
            tax_fields(body, p)
            require(p.get('manufacturer') and p.get('hsn_code') and p.get('gst_rate_bps') is not None, 'Manufacturer, HSN, and GST rate are required.')
            if body.get('opening_batch'):
                require(isinstance(body['opening_batch'], dict), 'Invalid opening batch.')
                new_batch(p, body['opening_batch'])
            else:
                require(body.get('stock', 0)==0, 'Receive opening stock with batch ID, manufacturing date, expiry, and MRP.')
            data['products'].append(p)
        audit(data, user, 'Product saved', p['sku'])
        return p
    if path == '/api/pricing':
        role(user, 'admin')
        data['pricing'] = dict(bulk_min=integer(body.get('bulk_min'), 'Bulk minimum', 1, 10000), bulk_discount_bps=integer(body.get('bulk_discount_bps'), 'Discount basis points', 0, 9000))
        audit(data, user, 'Pricing updated', str(data['pricing']))
        return data['pricing']
    if path == '/api/users':
        role(user, 'admin')
        if body.get('id'):
            u = find(data['users'], 'id', body['id'])
            if 'credit_limit' in body:
                require(u['role'] == 'retailer', 'Only retailers have trade credit.')
                limit = integer(body['credit_limit'], 'Credit limit')
                require(limit >= u['credit_used'], 'Credit limit cannot be below outstanding credit.')
                u['credit_limit'] = limit
            if 'active' in body:
                require(u['id'] != user['id'], 'You cannot deactivate your own account.')
                require(isinstance(body['active'], bool), 'Active must be true or false.')
                require(not body['active'] or u.get('approval_status','approved')=='approved', 'Approve this registration before enabling access.', 409)
                u['active'] = body['active']
                if not u['active']:
                    data['sessions'] = [session for session in data['sessions'] if session['user_id'] != u['id']]
        else:
            user_role = body.get('role')
            require(user_role in ('admin','retailer','distributor','delivery'), 'Invalid role.')
            email = text(body.get('email'), 'Email', 150).lower()
            require('@' in email and not any(u['email'] == email for u in data['users']), 'Email is invalid or already in use.')
            password = text(body.get('password'), 'Password', 128)
            require(len(password) >= 10, 'Password must contain at least 10 characters.')
            u = dict(id=uid('usr'), name=text(body.get('name'), 'Name', 100), business=text(body.get('business'), 'Business', 100), role=user_role, email=email, password=password_hash(password), active=True)
            if user_role == 'retailer':
                u.update(credit_limit=integer(body.get('credit_limit', 0), 'Credit limit'), credit_used=0, address=text(body.get('address'), 'Address', 500))
            if user_role in ('admin','retailer','distributor'):
                u.update(gstin='', state_code='29', legal_name=u['business'], drug_license='')
            u['approval_status'] = 'approved'
            data['users'].append(u)
        audit(data, user, 'Account updated', u['email'])
        return safe_user(u)
    if path == '/api/tracking':
        role(user, 'delivery')
        order = get_order(data, user, body.get('order_id'))
        require(order['status'] == 'out_for_delivery', 'Location updates require an active delivery.', 409)
        lat, lng = body.get('latitude'), body.get('longitude')
        require(isinstance(lat, (int,float)) and not isinstance(lat, bool) and -90 <= lat <= 90 and isinstance(lng, (int,float)) and not isinstance(lng, bool) and -180 <= lng <= 180, 'Invalid coordinates.')
        point = dict(latitude=lat, longitude=lng, at=now())
        order['tracking'].append(point)
        order['tracking'] = order['tracking'][-100:]
        return point
    if path == '/api/notifications/read':
        for n in data['notifications']:
            if n['user_id'] == user['id']:
                n['read'] = True
        return dict(ok=True)
    raise Problem('Endpoint not found.', 404)
