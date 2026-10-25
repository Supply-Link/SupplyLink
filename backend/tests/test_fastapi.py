"""HTTP contract checks for the production FastAPI adapter."""
import copy
import sys
import unittest
from contextlib import contextmanager
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.controllers.http import create_app
from app.services.portal import PortalService
from app.store import seed


class MemoryStore:
    kind = 'memory-test'

    def __init__(self):
        self.data = seed()

    @contextmanager
    def transaction(self):
        before = copy.deepcopy(self.data)
        try:
            yield self.data
        except Exception:
            self.data = before
            raise


class ActiveLicense:
    def status(self):
        return dict(usable=True, status='active', expires_on='2099-12-31', expires_at='2100-01-01T00:00:00+05:30')


class ExpiredLicense:
    def status(self):
        return dict(usable=False, status='expired', expires_on='2020-01-01', expires_at='2020-01-02T00:00:00+05:30')


class FastAPIContractTests(unittest.TestCase):
    def setUp(self):
        self.store = MemoryStore()
        self.client = TestClient(create_app(PortalService(self.store, ActiveLicense())))

    def login(self, role='retailer'):
        response = self.client.post('/api/login', json=dict(email=role + '@supplylink.local', password='Demo@123'))
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()['csrf']

    def test_login_workspace_and_order_contract(self):
        self.assertEqual(self.client.get('/api/health').json()['storage'], 'memory-test')
        self.assertEqual(self.client.get('/api/state').status_code, 401)
        csrf = self.login()
        self.assertEqual(self.client.get('/api/me').json()['user']['role'], 'retailer')
        workspace = self.client.get('/api/state')
        self.assertEqual(workspace.status_code, 200)
        self.assertTrue(workspace.json()['products'])
        body = dict(items=[dict(product_id='med01', quantity=10)], address='Test delivery address', payment_method='credit')
        self.assertEqual(self.client.post('/api/orders', json=body).status_code, 403)
        headers = {'X-CSRF-Token': csrf, 'Idempotency-Key': 'fastapi-test-order-1'}
        placed = self.client.post('/api/orders', json=body, headers=headers)
        self.assertEqual(placed.status_code, 200, placed.text)
        self.assertEqual(self.client.post('/api/orders', json=body, headers=headers).json()['id'], placed.json()['id'])
        self.assertEqual(len(self.client.get('/api/state').json()['orders']), 1)
        distributor_csrf = self.login('distributor')
        confirmed = self.client.post('/api/orders/' + placed.json()['id'], json={'status': 'confirmed'},
                                     headers={'X-CSRF-Token': distributor_csrf})
        self.assertEqual(confirmed.status_code, 200, confirmed.text)
        self.assertEqual(confirmed.json()['status'], 'confirmed')

    def test_origin_body_and_logout_guards(self):
        csrf = self.login()
        headers = {'X-CSRF-Token': csrf}
        self.assertEqual(self.client.post('/api/quote', content='[]', headers={**headers, 'Content-Type': 'application/json'}).status_code, 400)
        self.assertEqual(self.client.post('/api/quote', json={}, headers={**headers, 'Origin': 'https://evil.example'}).status_code, 403)
        self.assertEqual(self.client.post('/api/logout', json={}, headers=headers).status_code, 200)
        self.assertEqual(self.client.get('/api/me').status_code, 401)

    def test_expired_license_blocks_data_but_allows_sign_in_and_out(self):
        self.client.app.state.portal.license_store = ExpiredLicense()
        csrf = self.login()
        self.assertEqual(set(self.client.get('/api/me').json()['user']), {'id', 'name', 'role'})
        locked = self.client.get('/api/state')
        self.assertEqual(locked.status_code, 423)
        self.assertEqual(locked.json()['code'], 'SOFTWARE_LICENSE_BLOCKED')
        self.assertEqual(self.client.post('/api/quote', json={}, headers={'X-CSRF-Token': csrf}).status_code, 423)
        self.assertEqual(self.client.post('/api/logout', json={}, headers={'X-CSRF-Token': csrf}).status_code, 200)

    def test_delivery_proof_and_return_review_across_roles(self):
        csrf = self.login()
        body = dict(items=[dict(product_id='med01', quantity=2)], address='Pharmacy counter', payment_method='cod')
        placed = self.client.post('/api/orders', json=body, headers={'X-CSRF-Token': csrf, 'Idempotency-Key': 'full-flow-order-1'})
        self.assertEqual(placed.status_code, 200, placed.text)
        order_id = placed.json()['id']

        csrf = self.login('distributor')
        for transition in ({'status': 'confirmed'}, {'status': 'packed'}, {'status': 'out_for_delivery', 'driver_id': 'delivery'}):
            response = self.client.post('/api/orders/' + order_id, json=transition, headers={'X-CSRF-Token': csrf})
            self.assertEqual(response.status_code, 200, response.text)

        csrf = self.login('delivery')
        proof = self.client.post('/api/proof-of-delivery', json=dict(order_id=order_id, recipient_name='Test Recipient',
                                signature=[[[100, 100], [200, 150], [300, 130], [400, 170]]]),
                                headers={'X-CSRF-Token': csrf, 'Idempotency-Key': 'full-flow-proof-1'})
        self.assertEqual(proof.status_code, 200, proof.text)

        csrf = self.login()
        returned = self.client.post('/api/returns', json=dict(order_id=order_id, action='request', reason='Damaged pack'),
                                    headers={'X-CSRF-Token': csrf, 'Idempotency-Key': 'full-flow-return-1'})
        self.assertEqual(returned.status_code, 200, returned.text)

        csrf = self.login('distributor')
        reviewed = self.client.post('/api/returns', json=dict(order_id=order_id, action='approve', review_note='Bring to depot'),
                                    headers={'X-CSRF-Token': csrf})
        self.assertEqual(reviewed.status_code, 200, reviewed.text)
        csrf = self.login()
        order = self.client.get('/api/state').json()['orders'][0]
        self.assertEqual(order['status'], 'delivered')
        self.assertEqual(order['proof_of_delivery']['recipient_name'], 'Test Recipient')
        self.assertEqual(order['return_request']['status'], 'approved')


if __name__ == '__main__':
    unittest.main()
