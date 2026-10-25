"""Normalized PostgreSQL persistence while preserving the domain dictionary API."""
import copy
import json
import os
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from psycopg import sql
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from app.domain.pharmacy import migrate


SCHEMA = Path(__file__).resolve().parents[2] / 'db' / 'schema.sql'
LOCK_ID = 0x535550504C494E4B  # "SUPPLINK", serialized app-level transactions.


def _iso(value):
    return value.isoformat() if hasattr(value, 'isoformat') else value


def _extra(row, known):
    return {key: value for key, value in row.items() if key not in known}


def _merge(extra, values, optional=()):
    result = dict(extra or {})
    result.update(values)
    for key, value in optional:
        if value is not None:
            result[key] = value
    return result


def _insert_many(cursor, table, columns, rows):
    rows = list(rows)
    if not rows:
        return
    query = sql.SQL('INSERT INTO {} ({}) VALUES ({})').format(
        sql.Identifier(table),
        sql.SQL(', ').join(map(sql.Identifier, columns)),
        sql.SQL(', ').join(sql.Placeholder() for _ in columns),
    )
    cursor.executemany(query, rows)


class RelationalPostgresStore:
    kind = 'postgresql-relational'

    def __init__(self, database_url, seed_factory):
        sslmode = os.environ.get('DATABASE_SSLMODE', 'prefer')
        max_size = int(os.environ.get('DATABASE_POOL_SIZE', '10'))
        if not 1 <= max_size <= 50:
            raise ValueError('DATABASE_POOL_SIZE must be between 1 and 50.')
        self.seed_factory = seed_factory
        self.pool = ConnectionPool(
            conninfo=str(database_url),
            min_size=1,
            max_size=max_size,
            kwargs={
                'connect_timeout': 10,
                'prepare_threshold': None,
                'sslmode': sslmode,
            },
            open=True,
        )
        self.pool.wait(timeout=15)
        self._initialize()

    def _initialize(self):
        schema = SCHEMA.read_text()
        with self.pool.connection() as connection, connection.transaction():
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(schema)
                cursor.execute('SELECT pg_advisory_xact_lock(%s)', (LOCK_ID,))
                cursor.execute('SELECT EXISTS (SELECT 1 FROM users)')
                if cursor.fetchone()['exists']:
                    return
                cursor.execute("SELECT to_regclass('public.supplylink_state') AS table_name")
                legacy_table = cursor.fetchone()['table_name']
                data = None
                if legacy_table:
                    cursor.execute('SELECT data FROM supplylink_state WHERE id = 1')
                    row = cursor.fetchone()
                    if row:
                        data = row['data']
                source = 'legacy supplylink_state JSONB' if data else 'application seed'
                data = data or self.seed_factory()
                migrate(data)
                self._backup(cursor, source, data)
                self._write(cursor, data)

    def _backup(self, cursor, source, data):
        cursor.execute(
            """
            INSERT INTO migration_backups (source, data_version, snapshot)
            VALUES (%s, %s, %s)
            """,
            (source, data.get('version', 1), Jsonb(data)),
        )

    @contextmanager
    def transaction(self):
        with self.pool.connection() as connection, connection.transaction():
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute('SELECT pg_advisory_xact_lock(%s)', (LOCK_ID,))
                data = self._read(cursor)
                before = copy.deepcopy(data)
                yield data
                if data != before:
                    self._write(cursor, data)

    def import_state(self, data, source='JSON import'):
        if not isinstance(data, dict):
            raise ValueError('Imported state must be a JSON object.')
        imported = copy.deepcopy(data)
        migrate(imported)
        with self.pool.connection() as connection, connection.transaction():
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute('SELECT pg_advisory_xact_lock(%s)', (LOCK_ID,))
                current = self._read(cursor)
                self._backup(cursor, 'before ' + source, current)
                self._backup(cursor, source, imported)
                self._write(cursor, imported)

    def close(self):
        self.pool.close()

    def _read(self, cursor):
        cursor.execute('SELECT * FROM app_metadata WHERE id = 1')
        meta = cursor.fetchone()
        cursor.execute('SELECT * FROM users ORDER BY sort_order')
        users = []
        for row in cursor.fetchall():
            values = {
                'id': row['id'], 'name': row['name'], 'business': row['business'],
                'role': row['role'], 'email': row['email'], 'password': row['password_hash'],
                'active': row['active'], 'approval_status': row['approval_status'],
            }
            optional = (
                ('requested_role', row['requested_role']), ('registered_at', _iso(row['registered_at'])),
                ('reviewed_by', row['reviewed_by']), ('reviewed_at', _iso(row['reviewed_at'])),
                ('review_reason', row['review_reason']), ('credit_limit', row['credit_limit']),
                ('credit_used', row['credit_used']), ('address', row['address']),
                ('state_code', row['state_code']), ('gstin', row['gstin']),
                ('legal_name', row['legal_name']), ('drug_license', row['drug_license']),
            )
            users.append(_merge(row['extra'], values, optional))

        cursor.execute('SELECT * FROM products ORDER BY sort_order')
        products = []
        products_by_id = {}
        for row in cursor.fetchall():
            values = {
                'id': row['id'], 'name': row['name'], 'brand': row['brand'],
                'category': row['category'], 'sku': row['sku'], 'unit': row['unit'],
                'price': row['price'], 'stock': row['stock'], 'reorder': row['reorder_level'],
                'art': row['artwork'], 'color': row['color'], 'active': row['active'],
                'distributor_id': row['distributor_id'],
            }
            optional = (
                ('generic_name', row['generic_name']), ('strength', row['strength']),
                ('dosage_form', row['dosage_form']), ('reference_url', row['reference_url']),
                ('manufacturer', row['manufacturer']), ('hsn_code', row['hsn_code']),
                ('gst_rate_bps', row['gst_rate_bps']), ('storage_conditions', row['storage_conditions']),
            )
            product = _merge(row['extra'], values, optional)
            if row['is_demo']:
                product['demo'] = True
            if row['has_unallocated_stock']:
                product['unallocated_stock'] = row['unallocated_stock']
            if row['has_batches']:
                product['batches'] = []
            products.append(product)
            products_by_id[product['id']] = product

        cursor.execute('SELECT * FROM batches ORDER BY product_id, sort_order')
        for row in cursor.fetchall():
            batch = _merge(row['extra'], {
                'id': row['id'], 'batch_number': row['batch_number'],
                'manufacturing_date': _iso(row['manufacturing_date']),
                'expiry_date': _iso(row['expiry_date']), 'stock': row['stock'],
                'mrp': row['mrp'], 'purchase_price': row['purchase_price'],
                'quarantined': row['quarantined'],
            })
            if row['is_demo']:
                batch['demo'] = True
            products_by_id[row['product_id']].setdefault('batches', []).append(batch)

        cursor.execute('SELECT * FROM orders ORDER BY sort_order')
        orders = []
        orders_by_id = {}
        for row in cursor.fetchall():
            values = {'id': row['id'], 'status': row['status'], 'total': row['total']}
            optional = tuple(
                (key, _iso(row[column]) if column == 'created_at' else row[column])
                for key, column in (
                    ('number', 'number'), ('retailer_id', 'retailer_id'),
                    ('retailer_name', 'retailer_name'), ('distributor_id', 'distributor_id'),
                    ('address', 'address'), ('payment_method', 'payment_method'),
                    ('payment_status', 'payment_status'), ('created_at', 'created_at'),
                    ('request_key', 'request_key'), ('supply_state_code', 'supply_state_code'),
                    ('supplier_state_code', 'supplier_state_code'), ('tax_type', 'tax_type'),
                    ('subtotal', 'subtotal'), ('discount', 'discount'), ('taxable', 'taxable'),
                    ('cgst', 'cgst'), ('sgst', 'sgst'), ('utgst', 'utgst'),
                    ('igst', 'igst'), ('tax', 'tax'),
                )
            )
            order = _merge(row['extra'], values, optional)
            order['driver_id'] = row['driver_id']
            order.update(lines=[], history=[], tracking=[])
            orders.append(order)
            orders_by_id[order['id']] = order

        cursor.execute('SELECT * FROM order_parties ORDER BY order_id, party_type')
        for row in cursor.fetchall():
            party = _merge(row['extra'], {}, tuple(
                (key, row[key]) for key in (
                    'user_id', 'business', 'legal_name', 'address', 'gstin',
                    'state_code', 'drug_license',
                )
            ))
            if 'user_id' in party:
                party['id'] = party.pop('user_id')
            orders_by_id[row['order_id']][row['party_type']] = party

        cursor.execute('SELECT * FROM order_lines ORDER BY order_id, line_number')
        lines = {}
        for row in cursor.fetchall():
            line = _merge(row['extra'], {
                'product_id': row['product_id'], 'quantity': row['quantity'],
            }, tuple((key, row[key]) for key in (
                'name', 'unit', 'manufacturer', 'unit_price', 'subtotal', 'discount',
                'taxable', 'hsn_code', 'gst_rate_bps', 'cgst', 'sgst', 'utgst',
                'igst', 'tax', 'total',
            )))
            order = orders_by_id[row['order_id']]
            order['lines'].append(line)
            lines[(row['order_id'], row['line_number'])] = line

        cursor.execute(
            'SELECT * FROM order_batch_allocations '
            'ORDER BY order_id, line_number, allocation_number'
        )
        for row in cursor.fetchall():
            allocation = _merge(row['extra'], {'quantity': row['quantity']}, tuple(
                (key, _iso(row[key]) if key in ('manufacturing_date', 'expiry_date') else row[key])
                for key in ('batch_id', 'batch_number', 'manufacturing_date', 'expiry_date', 'mrp')
            ))
            lines[(row['order_id'], row['line_number'])].setdefault('batches', []).append(allocation)

        cursor.execute('SELECT * FROM order_history ORDER BY order_id, event_number')
        for row in cursor.fetchall():
            event = _merge(row['extra'], {
                'status': row['status'], 'at': _iso(row['occurred_at']), 'by': row['actor_name'],
            })
            orders_by_id[row['order_id']]['history'].append(event)

        cursor.execute('SELECT * FROM tracking_points ORDER BY order_id, point_number')
        for row in cursor.fetchall():
            point = _merge(row['extra'], {
                'latitude': row['latitude'], 'longitude': row['longitude'],
                'at': _iso(row['recorded_at']),
            })
            orders_by_id[row['order_id']]['tracking'].append(point)

        cursor.execute('SELECT * FROM payments ORDER BY sort_order')
        payments = [
            _merge(row['extra'], {
                'id': row['id'], 'order_id': row['order_id'],
                'order_number': row['order_number'], 'amount': row['amount'],
                'reference': row['reference'], 'actor_id': row['actor_id'],
                'request_key': row['request_key'], 'at': _iso(row['recorded_at']),
                'mode': row['mode'],
            })
            for row in cursor.fetchall()
        ]

        cursor.execute('SELECT * FROM notifications ORDER BY sort_order')
        notifications = [
            _merge(row['extra'], {
                'id': row['id'], 'user_id': row['user_id'], 'title': row['title'],
                'body': row['body'], 'at': _iso(row['created_at']), 'read': row['is_read'],
            })
            for row in cursor.fetchall()
        ]

        cursor.execute('SELECT * FROM sessions ORDER BY expires_at')
        sessions = [
            {
                'token_hash': row['token_hash'], 'user_id': row['user_id'],
                'csrf': row['csrf_token'], 'expires': row['expires_at'].timestamp(),
            }
            for row in cursor.fetchall()
        ]

        cursor.execute('SELECT * FROM audit_events ORDER BY sort_order')
        audit = [
            _merge(row['extra'], {
                'id': row['id'], 'actor': row['actor_id'], 'name': row['actor_name'],
                'action': row['action'], 'detail': row['detail'], 'at': _iso(row['occurred_at']),
            })
            for row in cursor.fetchall()
        ]

        cursor.execute('SELECT * FROM pricing WHERE id = 1')
        pricing = cursor.fetchone()
        return {
            'version': meta['data_version'], 'users': users, 'products': products,
            'orders': orders, 'payments': payments, 'notifications': notifications,
            'sessions': sessions, 'audit': audit,
            'pricing': {
                'bulk_min': pricing['bulk_min'],
                'bulk_discount_bps': pricing['bulk_discount_bps'],
            },
            'created_at': _iso(meta['created_at']),
        }

    def _write(self, cursor, data):
        for table in (
            'order_batch_allocations', 'order_history', 'tracking_points',
            'order_parties', 'order_lines', 'payments', 'notifications',
            'sessions', 'audit_events', 'batches', 'orders',
            'products', 'users', 'pricing', 'app_metadata',
        ):
            cursor.execute(sql.SQL('DELETE FROM {}').format(sql.Identifier(table)))

        _insert_many(cursor, 'app_metadata', ('id', 'data_version', 'created_at'), [
            (1, data.get('version', 3), data.get('created_at') or datetime.now(timezone.utc)),
        ])

        user_fields = {
            'id', 'name', 'business', 'role', 'email', 'password', 'active',
            'requested_role', 'approval_status', 'registered_at', 'reviewed_by',
            'reviewed_at', 'review_reason', 'credit_limit', 'credit_used', 'address',
            'state_code', 'gstin', 'legal_name', 'drug_license',
        }
        _insert_many(cursor, 'users', (
            'id', 'sort_order', 'name', 'business', 'role', 'email', 'password_hash',
            'active', 'requested_role', 'approval_status', 'registered_at', 'reviewed_by',
            'reviewed_at', 'review_reason', 'credit_limit', 'credit_used', 'address',
            'state_code', 'gstin', 'legal_name', 'drug_license', 'extra',
        ), (
            (
                user['id'], index, user['name'], user['business'], user['role'],
                user['email'], user['password'], user.get('active', False),
                user.get('requested_role'), user.get('approval_status', 'approved'),
                user.get('registered_at'), user.get('reviewed_by'), user.get('reviewed_at'),
                user.get('review_reason'), user.get('credit_limit'), user.get('credit_used'),
                user.get('address'), user.get('state_code'), user.get('gstin'),
                user.get('legal_name'), user.get('drug_license'),
                Jsonb(_extra(user, user_fields)),
            )
            for index, user in enumerate(data['users'])
        ))

        product_fields = {
            'id', 'name', 'generic_name', 'strength', 'dosage_form', 'brand',
            'category', 'sku', 'unit', 'price', 'stock', 'unallocated_stock',
            'reorder', 'art', 'color', 'active', 'distributor_id', 'demo',
            'reference_url', 'manufacturer', 'hsn_code', 'gst_rate_bps',
            'storage_conditions', 'batches',
        }
        _insert_many(cursor, 'products', (
            'id', 'sort_order', 'distributor_id', 'name', 'generic_name', 'strength',
            'dosage_form', 'brand', 'category', 'sku', 'unit', 'price', 'stock',
            'unallocated_stock', 'has_unallocated_stock', 'reorder_level', 'artwork', 'color', 'active',
            'is_demo', 'reference_url', 'manufacturer', 'hsn_code', 'gst_rate_bps',
            'storage_conditions', 'has_batches', 'extra',
        ), (
            (
                product['id'], index, product['distributor_id'], product['name'],
                product.get('generic_name'), product.get('strength'), product.get('dosage_form'),
                product['brand'], product['category'], product['sku'], product['unit'],
                product['price'], product.get('stock', 0), product.get('unallocated_stock', 0),
                'unallocated_stock' in product, product.get('reorder', 0), product.get('art'), product.get('color'),
                product.get('active', True), product.get('demo', False),
                product.get('reference_url'), product.get('manufacturer'),
                product.get('hsn_code'), product.get('gst_rate_bps'),
                product.get('storage_conditions'), 'batches' in product,
                Jsonb(_extra(product, product_fields)),
            )
            for index, product in enumerate(data['products'])
        ))

        batch_fields = {
            'id', 'batch_number', 'manufacturing_date', 'expiry_date', 'stock',
            'mrp', 'purchase_price', 'quarantined', 'demo',
        }
        _insert_many(cursor, 'batches', (
            'id', 'product_id', 'sort_order', 'batch_number', 'manufacturing_date',
            'expiry_date', 'stock', 'mrp', 'purchase_price', 'quarantined',
            'is_demo', 'extra',
        ), (
            (
                batch['id'], product['id'], index, batch['batch_number'],
                batch['manufacturing_date'], batch['expiry_date'], batch['stock'],
                batch['mrp'], batch.get('purchase_price', 0),
                batch.get('quarantined', False), batch.get('demo', False),
                Jsonb(_extra(batch, batch_fields)),
            )
            for product in data['products']
            for index, batch in enumerate(product.get('batches', []))
        ))

        order_fields = {
            'id', 'number', 'retailer_id', 'retailer_name', 'distributor_id',
            'driver_id', 'address', 'payment_method', 'payment_status', 'status',
            'created_at', 'request_key', 'supply_state_code', 'supplier_state_code',
            'tax_type', 'subtotal', 'discount', 'taxable', 'cgst', 'sgst', 'utgst',
            'igst', 'tax', 'total', 'lines', 'history', 'tracking', 'supplier', 'buyer',
        }
        _insert_many(cursor, 'orders', (
            'id', 'sort_order', 'number', 'retailer_id', 'retailer_name',
            'distributor_id', 'driver_id', 'address', 'payment_method',
            'payment_status', 'status', 'created_at', 'request_key',
            'supply_state_code', 'supplier_state_code', 'tax_type', 'subtotal',
            'discount', 'taxable', 'cgst', 'sgst', 'utgst', 'igst', 'tax',
            'total', 'extra',
        ), (
            (
                order['id'], index, order.get('number'), order.get('retailer_id'),
                order.get('retailer_name'), order.get('distributor_id'),
                order.get('driver_id'), order.get('address'), order.get('payment_method'),
                order.get('payment_status'), order['status'], order.get('created_at'),
                order.get('request_key'), order.get('supply_state_code'),
                order.get('supplier_state_code'), order.get('tax_type'),
                order.get('subtotal'), order.get('discount'), order.get('taxable'),
                order.get('cgst'), order.get('sgst'), order.get('utgst'),
                order.get('igst'), order.get('tax'), order['total'],
                Jsonb(_extra(order, order_fields)),
            )
            for index, order in enumerate(data['orders'])
        ))

        party_fields = {'id', 'business', 'legal_name', 'address', 'gstin', 'state_code', 'drug_license'}
        _insert_many(cursor, 'order_parties', (
            'order_id', 'party_type', 'user_id', 'business', 'legal_name',
            'address', 'gstin', 'state_code', 'drug_license', 'extra',
        ), (
            (
                order['id'], party_type, party.get('id'), party.get('business'),
                party.get('legal_name'), party.get('address'), party.get('gstin'),
                party.get('state_code'), party.get('drug_license'),
                Jsonb(_extra(party, party_fields)),
            )
            for order in data['orders']
            for party_type in ('supplier', 'buyer')
            if (party := order.get(party_type)) is not None
        ))

        line_fields = {
            'product_id', 'name', 'unit', 'manufacturer', 'quantity', 'unit_price',
            'subtotal', 'discount', 'taxable', 'hsn_code', 'gst_rate_bps', 'cgst',
            'sgst', 'utgst', 'igst', 'tax', 'total', 'batches',
        }
        _insert_many(cursor, 'order_lines', (
            'order_id', 'line_number', 'product_id', 'name', 'unit', 'manufacturer',
            'quantity', 'unit_price', 'subtotal', 'discount', 'taxable', 'hsn_code',
            'gst_rate_bps', 'cgst', 'sgst', 'utgst', 'igst', 'tax', 'total', 'extra',
        ), (
            (
                order['id'], index, line.get('product_id'), line.get('name'),
                line.get('unit'), line.get('manufacturer'), line['quantity'],
                line.get('unit_price'), line.get('subtotal'), line.get('discount'),
                line.get('taxable'), line.get('hsn_code'), line.get('gst_rate_bps'),
                line.get('cgst'), line.get('sgst'), line.get('utgst'),
                line.get('igst'), line.get('tax'), line.get('total'),
                Jsonb(_extra(line, line_fields)),
            )
            for order in data['orders']
            for index, line in enumerate(order.get('lines', []))
        ))

        allocation_fields = {
            'batch_id', 'batch_number', 'manufacturing_date', 'expiry_date',
            'mrp', 'quantity',
        }
        _insert_many(cursor, 'order_batch_allocations', (
            'order_id', 'line_number', 'allocation_number', 'batch_id',
            'batch_number', 'manufacturing_date', 'expiry_date', 'mrp',
            'quantity', 'extra',
        ), (
            (
                order['id'], line_index, allocation_index, allocation.get('batch_id'),
                allocation.get('batch_number'), allocation.get('manufacturing_date'),
                allocation.get('expiry_date'), allocation.get('mrp'),
                allocation['quantity'], Jsonb(_extra(allocation, allocation_fields)),
            )
            for order in data['orders']
            for line_index, line in enumerate(order.get('lines', []))
            for allocation_index, allocation in enumerate(line.get('batches', []))
        ))

        _insert_many(cursor, 'order_history', (
            'order_id', 'event_number', 'status', 'occurred_at', 'actor_name', 'extra',
        ), (
            (
                order['id'], index, event['status'], event['at'], event['by'],
                Jsonb(_extra(event, {'status', 'at', 'by'})),
            )
            for order in data['orders']
            for index, event in enumerate(order.get('history', []))
        ))

        _insert_many(cursor, 'tracking_points', (
            'order_id', 'point_number', 'latitude', 'longitude', 'recorded_at', 'extra',
        ), (
            (
                order['id'], index, point['latitude'], point['longitude'], point['at'],
                Jsonb(_extra(point, {'latitude', 'longitude', 'at'})),
            )
            for order in data['orders']
            for index, point in enumerate(order.get('tracking', []))
        ))

        payment_fields = {
            'id', 'order_id', 'order_number', 'amount', 'reference', 'actor_id',
            'request_key', 'at', 'mode',
        }
        _insert_many(cursor, 'payments', (
            'id', 'sort_order', 'order_id', 'order_number', 'amount', 'reference',
            'actor_id', 'request_key', 'recorded_at', 'mode', 'extra',
        ), (
            (
                payment['id'], index, payment['order_id'], payment.get('order_number'),
                payment['amount'], payment['reference'], payment['actor_id'],
                payment['request_key'], payment['at'], payment.get('mode', 'manual'),
                Jsonb(_extra(payment, payment_fields)),
            )
            for index, payment in enumerate(data['payments'])
        ))

        _insert_many(cursor, 'notifications', (
            'id', 'sort_order', 'user_id', 'title', 'body', 'created_at',
            'is_read', 'extra',
        ), (
            (
                note['id'], index, note['user_id'], note['title'], note['body'],
                note['at'], note.get('read', False),
                Jsonb(_extra(note, {'id', 'user_id', 'title', 'body', 'at', 'read'})),
            )
            for index, note in enumerate(data['notifications'])
        ))

        _insert_many(cursor, 'sessions', (
            'token_hash', 'user_id', 'csrf_token', 'expires_at',
        ), (
            (
                session['token_hash'], session['user_id'], session['csrf'],
                datetime.fromtimestamp(session['expires'], timezone.utc),
            )
            for session in data['sessions']
        ))

        _insert_many(cursor, 'audit_events', (
            'id', 'sort_order', 'actor_id', 'actor_name', 'action', 'detail',
            'occurred_at', 'extra',
        ), (
            (
                event['id'], index, event.get('actor'), event['name'], event['action'],
                event['detail'], event['at'],
                Jsonb(_extra(event, {'id', 'actor', 'name', 'action', 'detail', 'at'})),
            )
            for index, event in enumerate(data['audit'])
        ))

        _insert_many(cursor, 'pricing', (
            'id', 'bulk_min', 'bulk_discount_bps',
        ), [(
            1, data['pricing']['bulk_min'], data['pricing']['bulk_discount_bps'],
        )])
