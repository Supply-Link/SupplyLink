"""Page API role matrix, payload minimization, and tenant isolation."""
import copy
import unittest
from unittest.mock import patch

import test_fastapi as fixtures
from app.models.pages import PAGE_ROLES, PAGE_FIELDS


class PageAPITests(unittest.TestCase):
    setUp = fixtures.FastAPIContractTests.setUp
    login = fixtures.FastAPIContractTests.login

    def test_each_page_requires_authentication(self):
        for page in PAGE_ROLES:
            with self.subTest(page=page):
                self.assertEqual(self.client.get('/api/' + page).status_code, 401)

    def test_all_roles_receive_only_their_allowed_page_contracts(self):
        for role in ('admin', 'distributor', 'retailer', 'delivery'):
            self.login(role)
            for page, roles in PAGE_ROLES.items():
                with self.subTest(role=role, page=page):
                    response = self.client.get('/api/' + page)
                    self.assertEqual(response.status_code, 200 if role in roles else 403, response.text)
                    if role in roles:
                        body = response.json()
                        self.assertEqual(set(body), {'user', *PAGE_FIELDS[page]})
                        self.assertEqual(body['user']['role'], role)
                        self.assertNotIn('password', body['user'])
                        for person in body.get('users', []):
                            self.assertNotIn('password', person)

    def test_all_page_reads_enforce_licence(self):
        self.login('admin')
        self.client.app.state.portal.license_store = fixtures.ExpiredLicense()
        for page in PAGE_ROLES:
            response = self.client.get('/api/' + page)
            self.assertEqual(response.status_code, 423, response.text)
            self.assertEqual(response.json()['code'], 'SOFTWARE_LICENSE_BLOCKED')

    def test_distributor_inventory_and_catalog_hide_other_or_private_stock(self):
        foreign = copy.deepcopy(self.store.data['products'][0])
        foreign.update(id='foreign-product', distributor_id='another-distributor')
        self.store.data['products'].append(foreign)
        self.login('distributor')
        inventory = self.client.get('/api/inventory').json()
        self.assertTrue(inventory['products'])
        self.assertTrue(all(p['distributor_id'] == 'distributor' for p in inventory['products']))
        self.assertTrue(all(u['id'] == 'distributor' for u in inventory['users']))
        self.login('retailer')
        catalog = self.client.get('/api/catalog').json()
        for product in catalog['products']:
            self.assertTrue(product['active'])
            for batch in product.get('batches', []):
                self.assertNotIn('purchase_price', batch)

    def test_orders_payments_and_notifications_are_scoped_to_session(self):
        self.store.data['orders'] = [
            dict(id='own', retailer_id='retailer', distributor_id='distributor', driver_id='delivery'),
            dict(id='foreign', retailer_id='other-retailer', distributor_id='other-distributor', driver_id='other-driver'),
        ]
        self.store.data['payments'] = [dict(id='own-payment', order_id='own'), dict(id='foreign-payment', order_id='foreign')]
        self.store.data['notifications'] = [dict(id='own-note', user_id='retailer', read=False), dict(id='foreign-note', user_id='admin', read=False)]
        for role in ('distributor',):
            self.login(role)
            response = self.client.get('/api/payments').json()
            self.assertEqual([o['id'] for o in response['orders']], ['own'])
            self.assertEqual([p['id'] for p in response['payments']], ['own-payment'])
        for role in ('admin', 'retailer', 'delivery'):
            self.login(role)
            self.assertEqual(self.client.get('/api/payments').status_code, 403)
        self.login('retailer')
        self.assertEqual([n['id'] for n in self.client.get('/api/notifications').json()['notifications']], ['own-note'])
        self.assertEqual(self.client.get('/api/shell').json()['unread_notifications'], 1)
        self.assertEqual([u['id'] for u in self.client.get('/api/business').json()['users']], ['retailer'])

    def test_page_reads_do_not_build_the_legacy_snapshot_or_unneeded_stock(self):
        self.login('admin')
        with patch.object(self.client.app.state.portal.operations, 'snapshot', side_effect=AssertionError('whole workspace read')):
            with patch('app.models.page_data.stock_summary', side_effect=AssertionError('unneeded product work')):
                for page in ('people', 'pricing', 'activity', 'directory', 'notifications', 'shell'):
                    self.assertEqual(self.client.get('/api/' + page).status_code, 200)

    def test_saved_product_is_visible_in_page_api_without_workspace_fetch(self):
        csrf = self.login('distributor')
        product = self.client.get('/api/inventory').json()['products'][0]
        response = self.client.post('/api/inventory', json=dict(product_id=product['id'], batch_id=product['batches'][0]['id'], change=1, reason='Page API test'), headers={'X-CSRF-Token': csrf})
        self.assertEqual(response.status_code, 200, response.text)
        updated = self.client.get('/api/inventory').json()['products']
        refreshed = next(p for p in updated if p['id'] == product['id'])
        self.assertEqual(refreshed['batches'][0]['stock'], product['batches'][0]['stock'] + 1)


if __name__ == '__main__':
    unittest.main()
