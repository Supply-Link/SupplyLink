import copy
from datetime import datetime, timezone
import json
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
import urllib.request
import urllib.error

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from test_portal import Client
from server import PortalServer
from app.store import Store
from app.licensing import LicenseStore, create_issuer, issue_license, atomic_write
from app.ldap_server import LDAPServer, parse, number, octet, message, tlv


class LicensingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory()
        cls.root=Path(cls.temp.name)
        cls.public=cls.root/'public.pem'
        cls.private=create_issuer(cls.root/'issuer',cls.public)
        cls.path=cls.root/'secrets'/'software-license.json'
        cls.clock_value=datetime(2026,10,24,12,0,tzinfo=timezone.utc)
        cls.licensing=LicenseStore(cls.path,cls.public,lambda:cls.clock_value)
        cls.store=Store(cls.root/'portal.json')
        with cls.store.transaction() as data: cls.seed=copy.deepcopy(data)
        cls.server=PortalServer(('127.0.0.1',0),cls.store,cls.licensing)
        cls.server.RequestHandlerClass.log_message=lambda *args:None
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True)
        cls.thread.start()
        cls.base='http://127.0.0.1:'+str(cls.server.server_port)
        cls.ldap=LDAPServer(('127.0.0.1',0),cls.store,license_store=cls.licensing)
        cls.ldap_thread=threading.Thread(target=cls.ldap.serve_forever,daemon=True)
        cls.ldap_thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown();cls.server.server_close();cls.thread.join()
        cls.ldap.shutdown();cls.ldap.server_close();cls.ldap_thread.join()
        cls.temp.cleanup()

    def setUp(self):
        type(self).clock_value=datetime(2026,10,24,12,0,tzinfo=timezone.utc)
        issue_license(self.private,self.path,'2026-10-24','Test customer')
        self.server.attempts.clear();self.ldap.attempts.clear()
        with self.store.transaction() as data:
            data.clear();data.update(copy.deepcopy(self.seed))
        self.admin=Client(self.base).login('admin')
        self.retailer=Client(self.base).login('retailer')

    def expire(self):
        type(self).clock_value=datetime(2026,10,24,18,30,tzinfo=timezone.utc)

    def test_india_midnight_boundary_and_live_session_gate(self):
        type(self).clock_value=datetime(2026,10,24,18,29,59,999999,tzinfo=timezone.utc)
        self.assertTrue(self.licensing.status()['usable'])
        self.assertEqual(self.retailer.request('/api/state')[0],200)
        self.expire()
        self.assertEqual(self.licensing.status()['status'],'expired')
        status,error=self.retailer.request('/api/state')
        self.assertEqual(status,423)
        self.assertEqual(error['code'],'SOFTWARE_LICENSE_BLOCKED')
        self.assertNotIn('products',error)
        _,me=self.admin.request('/api/me')
        self.assertEqual(set(me['user']),{'id','name','role'})
        self.assertFalse(me['license']['usable'])
        self.assertNotIn('credit_limit',me['user'])

    def test_expired_login_and_logout_work_for_every_role(self):
        self.expire()
        for role in ('admin','distributor','retailer','delivery'):
            client=Client(self.base).login(role)
            self.assertEqual(client.request('/api/me')[0],200)
            self.assertEqual(client.request('/api/state')[0],423)
            self.assertEqual(client.request('/api/logout',{})[0],200)
            self.assertEqual(client.request('/api/me')[0],401)
        code,_=Client(self.base).request('/api/login',dict(email='admin@supplylink.local',password='incorrect'))
        self.assertEqual(code,401)

    def test_all_business_and_registration_routes_are_blocked_without_mutation(self):
        self.expire()
        with self.store.transaction() as data: before=copy.deepcopy(data)
        routes=('/api/orders','/api/orders/example','/api/quote','/api/payments','/api/proof-of-delivery','/api/returns','/api/inventory','/api/batches','/api/batches/quarantine','/api/business','/api/products','/api/pricing','/api/users','/api/registrations/approve','/api/registrations/reject','/api/tracking','/api/notifications/read','/api/register','/api/not-a-real-route')
        for route in routes:
            with self.subTest(route=route):
                self.assertEqual(self.admin.request(route,{})[0],423)
        with self.store.transaction() as data: self.assertEqual(data,before)
        for route in ('/.secrets/software-license.json','/config/license-public.pem','/license_admin.py','/../.secrets/software-license.json'):
            with self.assertRaises(urllib.error.HTTPError) as error: urllib.request.urlopen(self.base+route)
            self.assertEqual(error.exception.code,404)
            error.exception.close()
        self.assertEqual(Client(self.base).request('/api/license')[1]['status'],'expired')

    def test_hot_renewal_and_replacing_an_active_license(self):
        self.expire()
        self.assertEqual(self.admin.request('/api/state')[0],423)
        issue_license(self.private,self.path,'2026-10-25','Renewed customer')
        self.assertTrue(self.licensing.status()['usable'])
        self.assertEqual(self.admin.request('/api/state')[0],200)
        issue_license(self.private,self.path,'2026-10-23','Expired replacement')
        self.assertEqual(self.admin.request('/api/state')[0],423)

    def test_tampering_missing_corrupt_and_unsafe_permissions_fail_closed(self):
        envelope=json.loads(self.path.read_text())
        envelope['payload']['expires_on']='2099-12-31'
        atomic_write(self.path,json.dumps(envelope).encode())
        self.assertEqual(self.licensing.status()['status'],'invalid')
        self.assertEqual(self.admin.request('/api/state')[0],423)
        Client(self.base).login('delivery')
        atomic_write(self.path,b'{corrupt')
        self.assertEqual(self.licensing.status()['status'],'invalid')
        issue_license(self.private,self.path,'2026-10-24')
        self.path.chmod(0o644)
        self.assertEqual(self.licensing.status()['status'],'invalid')
        self.path.unlink()
        self.assertEqual(self.licensing.status()['status'],'unconfigured')
        self.assertEqual(self.admin.request('/api/state')[0],423)
        Client(self.base).login('distributor')

    def test_wrong_key_and_crypto_failure_fail_closed(self):
        other_public=self.root/'other-public.pem'
        other_private=create_issuer(self.root/'other-issuer',other_public)
        issue_license(other_private,self.path,'2099-12-31')
        self.assertEqual(self.licensing.status()['status'],'invalid')
        issue_license(self.private,self.path,'2026-10-24')
        fresh=LicenseStore(self.path,self.public)
        with patch('app.licensing.shutil.which',return_value=None):
            self.assertEqual(fresh.status()['status'],'invalid')
        self.assertEqual(self.private.stat().st_mode&0o777,0o600)
        self.assertEqual(self.path.stat().st_mode&0o777,0o600)
        self.assertEqual(self.path.parent.stat().st_mode&0o777,0o700)

    def test_transaction_rolls_back_if_license_expires_during_write(self):
        from app.domain import mutate
        before=self.retailer.state()['products'][0]['stock']
        def expire_after_mutation(*args,**kwargs):
            result=mutate(*args,**kwargs)
            self.expire()
            return result
        payload=dict(items=[dict(product_id='med01',quantity=1)],address='Test street',payment_method='cod')
        with patch('server.mutate',side_effect=expire_after_mutation):
            self.assertEqual(self.retailer.request('/api/orders',payload,'license-expiry-transaction')[0],423)
        with self.store.transaction() as data:
            self.assertEqual(data['products'][0]['stock'],before)
            self.assertEqual(data['orders'],[])

    def test_ldap_bind_survives_but_existing_search_is_blocked_then_renewed(self):
        def receive(conn):
            def exact(n):
                data=b''
                while len(data)<n:
                    chunk=conn.recv(n-len(data))
                    if not chunk: raise EOFError()
                    data+=chunk
                return data
            tag,length=exact(2)
            if length&128: length=int.from_bytes(exact(length&127),'big')
            return parse(exact(length))[1]
        with socket.create_connection(self.ldap.server_address,timeout=3) as conn:
            conn.sendall(message(1,tlv(0x60,number(3)+octet('admin@supplylink.local')+octet('Demo@123',0x80))))
            _,reply=receive(conn)
            self.assertEqual(int.from_bytes(parse(reply)[0][1],'big'),0)
            self.expire()
            search=octet('ou=people,dc=supplylink,dc=local')+number(2,10)+number(0,10)+number(0)+number(0)+tlv(1,b'\0')+octet('objectClass',0x87)+tlv(0x30,b'')
            conn.sendall(message(2,tlv(0x63,search)))
            tag,reply=receive(conn)
            self.assertEqual(tag,0x65)
            self.assertEqual(int.from_bytes(parse(reply)[0][1],'big'),53)
            # Reauthentication also remains available after expiry.
            conn.sendall(message(3,tlv(0x60,number(3)+octet('admin@supplylink.local')+octet('Demo@123',0x80))))
            _,reply=receive(conn)
            self.assertEqual(int.from_bytes(parse(reply)[0][1],'big'),0)
            issue_license(self.private,self.path,'2026-10-25')
            conn.sendall(message(4,tlv(0x63,search)))
            found=0
            while True:
                tag,reply=receive(conn)
                if tag==0x65:
                    self.assertEqual(int.from_bytes(parse(reply)[0][1],'big'),0);break
                self.assertEqual(tag,0x64);found+=1
            self.assertGreater(found,0)


if __name__=='__main__':unittest.main()
