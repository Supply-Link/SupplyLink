import concurrent.futures
import copy
import http.cookiejar
import json
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import PortalServer
from app.store import Store
from app.licensing import LicenseStore, create_issuer, issue_license

class Client:
    def __init__(self, base):
        self.base, self.csrf = base, ''
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    def request(self, path, body=None, key=None, csrf=True, origin=None):
        headers = {}
        if body is not None:
            headers['Content-Type']='application/json'
            if csrf: headers['X-CSRF-Token']=self.csrf
            if key: headers['Idempotency-Key']=key
        if origin: headers['Origin']=origin
        req=urllib.request.Request(self.base+path,data=json.dumps(body).encode() if body is not None else None,headers=headers)
        try: response=self.opener.open(req)
        except urllib.error.HTTPError as error: response=error
        with response: return response.status,json.loads(response.read())
    def login(self,name):
        code,body=self.request('/api/login',dict(email=name+'@supplylink.local',password='Demo@123'))
        assert code==200,body
        self.csrf=body['csrf']
        return self
    def state(self):
        code,body=self.request('/api/state')
        assert code==200,body
        return body

class PortalTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory()
        cls.path=Path(cls.temp.name)/'portal.json'
        cls.public_key=Path(cls.temp.name)/'license-public.pem'
        cls.private_key=create_issuer(Path(cls.temp.name)/'issuer',cls.public_key)
        cls.license_path=Path(cls.temp.name)/'secrets'/'license.json'
        issue_license(cls.private_key,cls.license_path,'2099-12-31','Automated test fixture')
        cls.license_store=LicenseStore(cls.license_path,cls.public_key)
        cls.store=Store(cls.path)
        with cls.store.transaction() as data: cls.seed=copy.deepcopy(data)
        cls.server=PortalServer(('127.0.0.1',0),cls.store,cls.license_store)
        cls.server.RequestHandlerClass.log_message=lambda *args:None
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True)
        cls.thread.start()
        cls.base='http://127.0.0.1:'+str(cls.server.server_port)
    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown();cls.server.server_close();cls.thread.join();cls.temp.cleanup()
    def setUp(self):
        with self.store.transaction() as data:
            data.clear();data.update(copy.deepcopy(self.seed))
        self.server.attempts.clear()
        self.admin=Client(self.base).login('admin')
        self.retailer=Client(self.base).login('retailer')
        self.distributor=Client(self.base).login('distributor')
        self.driver=Client(self.base).login('delivery')
    def place(self,client=None,quantity=10,method='credit',key='test-order-1'):
        return (client or self.retailer).request('/api/orders',dict(items=[dict(product_id='med01',quantity=quantity)],address='Test delivery address',payment_method=method),key)
    def transition(self,client,order,status,**fields):
        return client.request('/api/orders/'+order['id'],dict(status=status,**fields))
    def deliver(self,order):
        for status in ('confirmed','packed'):
            self.assertEqual(self.transition(self.distributor,order,status)[0],200)
        self.assertEqual(self.transition(self.distributor,order,'out_for_delivery',driver_id='delivery')[0],200)
        self.assertEqual(self.transition(self.driver,order,'delivered')[0],200)
    def test_complete_order_credit_payment_and_persistence(self):
        status,order=self.place()
        self.assertEqual(status,200)
        self.assertEqual(order['discount'],1100)
        self.assertEqual(order['total'],21946)
        self.assertEqual(self.retailer.state()['user']['credit_used'],21946)
        self.assertEqual(self.retailer.state()['products'][0]['stock'],170)
        self.deliver(order)
        payload=dict(order_id=order['id'],amount=order['total'],reference='CASH-001')
        status,payment=self.driver.request('/api/payments',payload,'payment-key-1')
        self.assertEqual(status,200)
        _,repeated=self.driver.request('/api/payments',payload,'payment-key-1')
        self.assertEqual(payment['id'],repeated['id'])
        self.assertEqual(self.driver.request('/api/payments',payload,'another-payment-key')[0],409)
        state=self.retailer.state()
        self.assertEqual(state['user']['credit_used'],0)
        self.assertEqual(state['orders'][0]['payment_status'],'paid')
        self.assertEqual(len(state['payments']),1)
        with Store(self.path).transaction() as data:
            self.assertEqual(data['orders'][0]['payment_status'],'paid')
            self.assertEqual(data['products'][0]['stock'],170)
            self.assertGreater(len(data['audit']),4)
        self.assertTrue(state['notifications'])
        self.assertFalse(any('password' in u for u in self.admin.state()['users']))
    def test_role_permissions_and_record_isolation(self):
        _,order=self.place()
        other=Client(self.base).login('retailer2')
        self.assertEqual(other.state()['orders'],[])
        self.assertEqual(self.driver.state()['products'],[])
        self.assertEqual(self.driver.state()['orders'],[])
        self.assertEqual(self.transition(other,order,'cancelled')[0],403)
        self.assertEqual(self.transition(self.driver,order,'delivered')[0],403)
        self.assertEqual(self.transition(self.retailer,order,'confirmed')[0],403)
        self.assertEqual(self.retailer.request('/api/inventory',dict(product_id='med01',change=10,reason='denied'))[0],403)
        self.assertEqual(self.distributor.request('/api/users',dict(id='retailer',credit_limit=99999999))[0],403)
        self.assertEqual(self.retailer.request('/api/pricing',dict(bulk_min=1,bulk_discount_bps=0))[0],403)
    def test_cancellation_restores_stock_and_credit_once(self):
        _,order=self.place()
        self.assertEqual(self.transition(self.retailer,order,'cancelled')[0],200)
        self.assertEqual(self.transition(self.retailer,order,'cancelled')[0],409)
        self.assertEqual(self.retailer.state()['products'][0]['stock'],180)
        self.assertEqual(self.retailer.state()['user']['credit_used'],0)
    def test_failed_order_preserves_stock_and_credit(self):
        before=self.retailer.state()
        self.assertEqual(self.place(quantity=1000)[0],409)
        self.assertEqual(self.admin.request('/api/users',dict(id='retailer',credit_limit=1))[0],200)
        self.assertEqual(self.place()[0],409)
        self.assertEqual(self.retailer.state()['products'],before['products'])
        self.assertEqual(self.retailer.state()['user']['credit_used'],0)
        self.assertEqual(self.retailer.state()['orders'],[])
        body=dict(items=[dict(product_id='med01',quantity=1),dict(product_id='bad',quantity=1)],address='Test',payment_method='cod')
        self.assertEqual(self.retailer.request('/api/orders',body,'rollback-key')[0],404)
        self.assertEqual(self.retailer.state()['products'],before['products'])
    def test_session_csrf_origin_and_deactivation(self):
        self.assertEqual(Client(self.base).request('/api/state')[0],401)
        self.assertEqual(Client(self.base).request('/api/login',dict(email='admin@supplylink.local',password='wrong'))[0],401)
        body=dict(bulk_min=10,bulk_discount_bps=0)
        self.assertEqual(self.admin.request('/api/pricing',body,csrf=False)[0],403)
        self.assertEqual(self.admin.request('/api/pricing',body,origin='https://evil.example')[0],403)
        self.assertEqual(self.admin.request('/api/users',dict(id='retailer',active=False))[0],200)
        self.assertEqual(self.retailer.request('/api/state')[0],401)
        self.assertEqual(self.admin.request('/api/users',dict(id='admin',active=False))[0],400)
    def test_duplicate_requests_and_concurrent_stock_reservation(self):
        code,first=self.place(quantity=1)
        self.assertEqual(code,200)
        _,second=self.place(quantity=1)
        self.assertEqual(first['id'],second['id'])
        self.assertEqual(self.retailer.state()['products'][0]['stock'],179)
        self.admin.request('/api/inventory',dict(product_id='med01',batch_id='batch-demo-med01',change=-178,reason='One unit left'))
        other=Client(self.base).login('retailer2')
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            f1=pool.submit(self.place,self.retailer,1,'cod','concurrent-key-1')
            f2=pool.submit(self.place,other,1,'cod','concurrent-key-2')
            codes=sorted([f1.result()[0],f2.result()[0]])
        self.assertEqual(codes,[200,409])
        self.assertEqual(self.admin.state()['products'][0]['stock'],0)
    def test_tracking_and_order_state_constraints(self):
        _,order=self.place()
        self.assertEqual(self.transition(self.distributor,order,'packed')[0],409)
        point=dict(order_id=order['id'],latitude=12.9,longitude=77.5)
        self.assertEqual(self.retailer.request('/api/tracking',point)[0],403)
        self.transition(self.distributor,order,'confirmed')
        self.transition(self.distributor,order,'packed')
        self.assertEqual(self.transition(self.distributor,order,'out_for_delivery',driver_id='retailer')[0],400)
        self.transition(self.distributor,order,'out_for_delivery',driver_id='delivery')
        self.assertEqual(self.driver.request('/api/tracking',dict(point,latitude=91))[0],400)
        self.assertEqual(self.driver.request('/api/tracking',point)[0],200)
        self.assertEqual(self.retailer.state()['orders'][0]['tracking'][0]['latitude'],12.9)
        self.assertEqual(self.transition(self.retailer,order,'cancelled')[0],409)
    def test_product_account_creation_and_price_snapshot(self):
        _,order=self.place()
        self.assertEqual(self.admin.request('/api/pricing',dict(bulk_min=1,bulk_discount_bps=1000))[0],200)
        self.assertEqual(self.distributor.request('/api/products',dict(id='med01',price=10000))[0],200)
        self.assertEqual(self.retailer.state()['orders'][0]['total'],order['total'])
        status,product=self.distributor.request('/api/products',dict(name='Test medicine 500 mg',generic_name='Test medicine',strength='500 mg',dosage_form='Tablets',brand='Test',category='Pain & fever',sku='TEST-1',unit='Strip of 10 tablets',price=20000,manufacturer='Test manufacturer',hsn_code='3004',gst_rate_bps=500,stock=0,reorder=2,opening_batch=dict(batch_number='NEW-001',manufacturing_date='2026-01-01',expiry_date='2030-12-31',stock=10,mrp=25000,purchase_price=15000)))
        self.assertEqual(status,200)
        self.assertEqual(product['distributor_id'],'distributor')
        status,user=self.admin.request('/api/users',dict(name='New retailer',business='New store',email='new@example.test',password='LongPassword123',role='retailer',credit_limit=100000,address='Test street'))
        self.assertEqual(status,200)
        code,login=Client(self.base).request('/api/login',dict(email='new@example.test',password='LongPassword123'))
        self.assertEqual(code,200)
        self.assertNotIn('password',login['user'])
    def test_invalid_input_rollback(self):
        self.assertEqual(self.place(quantity=True)[0],400)
        before=self.admin.state()['products']
        self.assertEqual(self.distributor.request('/api/products',dict(id='med01',name='Changed',price=-100))[0],400)
        self.assertEqual(self.admin.state()['products'],before)
    def test_corrupt_file_is_not_overwritten(self):
        path=Path(self.temp.name)/'corrupt.json'
        path.write_text('{broken data')
        with self.assertRaises(json.JSONDecodeError): Store(path)
        self.assertEqual(path.read_text(),'{broken data')

    def test_gst_intra_inter_exempt_and_union_territory(self):
        body=dict(items=[dict(product_id='med01',quantity=10)],supply_state_code='29')
        status,quote=self.retailer.request('/api/quote',body)
        self.assertEqual(status,200)
        self.assertEqual((quote['taxable'],quote['cgst'],quote['sgst'],quote['igst'],quote['total']),(20900,523,523,0,21946))
        status,quote=self.retailer.request('/api/quote',dict(body,supply_state_code='27'))
        self.assertEqual((quote['cgst'],quote['sgst'],quote['igst'],quote['total']),(0,0,1045,21945))
        self.admin.request('/api/products',dict(id='med01',gst_rate_bps=0))
        _,quote=self.retailer.request('/api/quote',body)
        self.assertEqual((quote['tax'],quote['total']),(0,20900))
        self.admin.request('/api/products',dict(id='med01',gst_rate_bps=500))
        with self.store.transaction() as data:
            next(u for u in data['users'] if u['id']=='distributor')['state_code']='04'
        _,quote=self.retailer.request('/api/quote',dict(body,supply_state_code='04'))
        self.assertEqual((quote['cgst'],quote['sgst'],quote['utgst'],quote['tax_type']),(523,0,523,'CGST + UTGST'))
        self.assertEqual(self.retailer.request('/api/quote',dict(body,supply_state_code='99'))[0],400)

    def test_batch_fefo_split_and_exact_cancellation(self):
        from datetime import timedelta
        from app.pharmacy import today
        batch=dict(product_id='med01',batch_number='EARLY-LOT',manufacturing_date=(today()-timedelta(days=50)).isoformat(),expiry_date=(today()+timedelta(days=10)).isoformat(),stock=5,mrp=3300,purchase_price=1700)
        code,received=self.distributor.request('/api/batches',batch)
        self.assertEqual(code,200)
        _,order=self.place(quantity=8)
        allocations=order['lines'][0]['batches']
        self.assertEqual([(a['batch_number'],a['quantity']) for a in allocations],[('EARLY-LOT',5),('DEMO-001-01',3)])
        self.assertEqual(self.retailer.state()['products'][0]['stock'],177)
        self.transition(self.retailer,order,'cancelled')
        product=self.admin.state()['products'][0]
        self.assertEqual(product['stock'],185)
        self.assertEqual({b['id']:b['stock'] for b in product['batches']}[received['id']],5)
        self.assertEqual(self.distributor.request('/api/batches',dict(batch,batch_number='early-lot'))[0],409)

    def test_expired_quarantine_and_dispatch_blocking(self):
        from datetime import timedelta
        from app.pharmacy import today
        with self.store.transaction() as data:
            data['products'][0]['batches'][0]['expiry_date']=(today()-timedelta(days=1)).isoformat()
        product=self.retailer.state()['products'][0]
        self.assertEqual((product['stock'],product['expired_stock']),(0,180))
        self.assertEqual(self.place(quantity=1)[0],409)
        with self.store.transaction() as data:
            data['products'][0]['batches'][0]['expiry_date']=today().isoformat()
        status,order=self.place(quantity=1)
        self.assertEqual(status,200)  # Expiry is valid through the entered date.
        body=dict(product_id='med01',batch_id='batch-demo-med01',quarantined=True,reason='Quality inspection')
        self.assertEqual(self.distributor.request('/api/batches/quarantine',body)[0],200)
        self.assertEqual(self.place(quantity=1,key='second-order')[0],409)
        self.assertEqual(self.transition(self.distributor,order,'confirmed')[0],409)
        self.assertEqual(self.transition(self.retailer,order,'cancelled')[0],200)
        product=self.admin.state()['products'][0]
        self.assertEqual((product['stock'],product['quarantined_stock']),(0,180))
        self.distributor.request('/api/batches/quarantine',dict(body,quarantined=False))
        self.assertEqual(self.admin.state()['products'][0]['stock'],180)

    def test_batch_dates_mrp_and_permissions(self):
        from datetime import timedelta
        from app.pharmacy import today
        batch=dict(product_id='med01',batch_number='LOT-TEST',manufacturing_date=(today()-timedelta(days=20)).isoformat(),expiry_date=(today()+timedelta(days=100)).isoformat(),stock=10,mrp=3000,purchase_price=1500)
        self.assertEqual(self.retailer.request('/api/batches',batch)[0],403)
        for changes in [dict(mrp=100),dict(expiry_date='2026-02-30'),dict(manufacturing_date=(today()+timedelta(days=1)).isoformat()),dict(stock=True),dict(purchase_price=5000)]:
            self.assertEqual(self.distributor.request('/api/batches',dict(batch,**changes))[0],400)
        self.assertEqual(self.admin.state()['products'][0]['stock'],180)
        self.assertEqual(self.distributor.request('/api/inventory',dict(product_id='med01',batch_id='batch-demo-med01',change=-181,reason='Invalid reduction'))[0],409)
        self.admin.request('/api/products',dict(id='med01',price=99999))
        self.assertEqual(self.place(quantity=1)[0],409)

    def test_business_profile_and_historical_tax_snapshot(self):
        body=dict(user_id='distributor',legal_name='Demo supplier',address='Business street',state_code='29',gstin='29ABCDE1234F1Z5',drug_license='DEMO-DL-001')
        self.assertEqual(self.retailer.request('/api/business',body)[0],403)
        self.assertEqual(self.distributor.request('/api/business',dict(body,gstin='27ABCDE1234F1Z5'))[0],400)
        self.assertEqual(self.distributor.request('/api/business',body)[0],200)
        _,order=self.place(quantity=1)
        self.assertEqual(order['supplier']['gstin'],'29ABCDE1234F1Z5')
        self.admin.request('/api/products',dict(id='med01',gst_rate_bps=0))
        self.distributor.request('/api/business',dict(body,legal_name='Changed supplier'))
        persisted=self.retailer.state()['orders'][0]
        self.assertEqual(persisted['supplier']['legal_name'],'Demo supplier')
        self.assertEqual(persisted['lines'][0]['gst_rate_bps'],500)
        self.assertNotIn('purchase_price',self.retailer.state()['products'][0]['batches'][0])

    def test_registration_approval_rejection_and_role_assignment(self):
        payload=dict(name='Applicant',business='New pharmacy',email='applicant@example.test',password='NewPassword123',role='retailer',address='Registered street',state_code='29',active=True,credit_limit=99999999)
        public=Client(self.base)
        self.assertEqual(public.request('/api/register',dict(payload,role='admin'))[0],400)
        self.assertEqual(public.request('/api/register',payload)[0],200)
        self.assertEqual(public.request('/api/register',payload)[0],409)
        self.assertEqual(public.request('/api/login',dict(email=payload['email'],password=payload['password']))[0],401)
        account=next(u for u in self.admin.state()['users'] if u['email']==payload['email'])
        self.assertEqual((account['active'],account['approval_status'],account['credit_limit']),(False,'pending',0))
        approval=dict(user_id=account['id'],role='distributor')
        self.assertEqual(self.retailer.request('/api/registrations/approve',approval)[0],403)
        self.assertEqual(self.admin.request('/api/users',dict(id=account['id'],active=True))[0],409)
        self.assertEqual(self.admin.request('/api/registrations/reject',dict(user_id=account['id'],reason='Needs licence details'))[0],200)
        self.assertEqual(public.request('/api/login',dict(email=payload['email'],password=payload['password']))[0],401)
        self.assertEqual(self.admin.request('/api/registrations/approve',approval)[0],200)
        code,login=public.request('/api/login',dict(email=payload['email'],password=payload['password']))
        self.assertEqual(code,200)
        self.assertEqual(login['user']['role'],'distributor')
        public.csrf=login['csrf']
        self.assertEqual(public.state()['orders'],[])
        self.admin.request('/api/users',dict(id=account['id'],active=False))
        self.assertEqual(public.request('/api/state')[0],401)
        self.admin.request('/api/users',dict(id=account['id'],active=True))
        self.assertEqual(public.request('/api/state')[0],401)  # Deactivation revokes sessions permanently.

    def test_registration_for_all_public_roles_and_invalid_fields(self):
        for role in ('retailer','distributor','delivery'):
            payload=dict(name='Applicant '+role,business='Test team',email=role+'@example.test',password='NewPassword123',role=role,address='Test street',state_code='29')
            self.assertEqual(Client(self.base).request('/api/register',payload)[0],200)
        payload=dict(name='Bad input',business='Team',email='invalid',password='short',role='delivery',address='Street',state_code='99')
        self.assertEqual(Client(self.base).request('/api/register',payload)[0],400)

    def test_migration_backup_legacy_orders_and_unallocated_stock(self):
        from app.store import seed
        path=Path(self.temp.name)/'legacy.json'
        data=seed();data['version']=1
        product=data['products'][0]
        product.pop('batches');product['demo']=False
        original_order=dict(id='legacy-order',total=200,lines=[dict(product_id='med01',quantity=1,unit_price=200)],status='cancelled')
        data['orders']=[original_order]
        path.write_text(json.dumps(data))
        migrated=Store(path)
        with migrated.transaction() as saved:
            self.assertEqual(saved['version'],3)
            self.assertEqual(saved['orders'],[original_order])
            self.assertEqual(saved['products'][0]['unallocated_stock'],180)
            self.assertEqual(saved['products'][0]['stock'],0)
        self.assertTrue(list((path.parent/'backups').glob('legacy-before-batches-*.json')))

    def test_stale_quote_and_logout(self):
        payload=dict(items=[dict(product_id='med01',quantity=1)],address='Street',payment_method='cod',expected_total=1)
        self.assertEqual(self.retailer.request('/api/orders',payload,'stale-quote-key')[0],409)
        self.assertEqual(self.retailer.state()['orders'],[])
        self.assertEqual(self.retailer.request('/api/me')[0],200)
        self.assertEqual(self.retailer.request('/api/logout',{})[0],200)
        self.assertEqual(self.retailer.request('/api/me')[0],401)

    def test_real_ldap_clients_bind_search_and_revocation(self):
        import shutil
        import subprocess
        if not shutil.which('ldapsearch') or not shutil.which('ldapwhoami'):
            self.skipTest('OpenLDAP client tools are unavailable')
        from app.ldap_server import LDAPServer
        ldap=LDAPServer(('127.0.0.1',0),self.store,license_store=self.license_store)
        thread=threading.Thread(target=ldap.serve_forever,daemon=True);thread.start()
        endpoint='ldap://127.0.0.1:'+str(ldap.server_address[1])
        password=Path(self.temp.name)/'test-password';password.write_text('Demo@123');password.chmod(0o600)
        def run(tool,*args):
            return subprocess.run([tool,'-x','-H',endpoint,*args],capture_output=True,text=True,timeout=10)
        try:
            admin_dn='uid=admin,ou=people,dc=supplylink,dc=local'
            retailer_dn='uid=retailer,ou=people,dc=supplylink,dc=local'
            who=run('ldapwhoami','-D',admin_dn,'-y',str(password))
            self.assertEqual(who.returncode,0,who.stderr)
            self.assertIn('dn:'+admin_dn,who.stdout)
            search=run('ldapsearch','-LLL','-D',admin_dn,'-y',str(password),'-b','ou=people,dc=supplylink,dc=local','(objectClass=inetOrgPerson)','uid','mail','title')
            self.assertEqual(search.returncode,0,search.stderr)
            self.assertIn('uid: retailer2',search.stdout)
            self.assertNotIn('password',search.stdout)
            own=run('ldapsearch','-LLL','-D',retailer_dn,'-y',str(password),'-b','ou=people,dc=supplylink,dc=local','(objectClass=inetOrgPerson)','uid')
            self.assertEqual(own.returncode,0,own.stderr)
            self.assertIn('uid: retailer\n',own.stdout)
            self.assertNotIn('uid: retailer2',own.stdout)
            anonymous=run('ldapsearch','-LLL','-b','ou=people,dc=supplylink,dc=local','(objectClass=*)')
            self.assertNotEqual(anonymous.returncode,0)
            self.admin.request('/api/users',dict(id='retailer',active=False))
            revoked=run('ldapwhoami','-D',retailer_dn,'-y',str(password))
            self.assertNotEqual(revoked.returncode,0)
            self.assertIn('Invalid credentials',revoked.stderr)
        finally:
            ldap.shutdown();ldap.server_close();thread.join()

    def test_ldap_pending_account_and_failed_rebind(self):
        import socket
        from app.ldap_server import LDAPServer,tlv,number,octet,message,parse
        ldap=LDAPServer(('127.0.0.1',0),self.store,license_store=self.license_store)
        thread=threading.Thread(target=ldap.serve_forever,daemon=True);thread.start()
        def read(connection):
            def exact(n):
                data=b''
                while len(data)<n:data+=connection.recv(n-len(data))
                return data
            tag,length=exact(2)
            if length&128:length=int.from_bytes(exact(length&127),'big')
            return parse(exact(length))[1]
        def bind(connection,msg_id,identity,password):
            connection.sendall(message(msg_id,tlv(0x60,number(3)+octet(identity)+octet(password,0x80))))
            _,payload=read(connection)
            return int.from_bytes(parse(payload)[0][1],'big')
        try:
            public=Client(self.base)
            payload=dict(name='Pending',business='Team',email='pending@example.test',password='PendingPassword123',role='delivery',address='Street',state_code='29')
            self.assertEqual(public.request('/api/register',payload)[0],200)
            with socket.create_connection(ldap.server_address,timeout=3) as conn:
                self.assertEqual(bind(conn,1,payload['email'],payload['password']),49)
                self.assertEqual(bind(conn,2,'admin@supplylink.local','Demo@123'),0)
                self.assertEqual(bind(conn,3,'admin@supplylink.local','incorrect'),49)
                conn.sendall(message(4,tlv(0x77,octet('1.3.6.1.4.1.4203.1.11.3',0x80))))
                _,reply=read(conn)
                self.assertEqual(next(v for t,v in parse(reply) if t==0x8b),b'')
        finally:
            ldap.shutdown();ldap.server_close();thread.join()

    def test_backend_serves_api_only_with_security_headers(self):
        with urllib.request.urlopen(self.base+'/api/health') as response:
            self.assertEqual(response.status,200)
            self.assertEqual(response.headers['Content-Type'],'application/json; charset=utf-8')
            self.assertIn('nosniff',response.headers['X-Content-Type-Options'])
            self.assertIn("script-src 'self'",response.headers['Content-Security-Policy'])
            self.assertEqual(response.headers['Cache-Control'],'no-store')
            self.assertEqual(json.loads(response.read())['status'],'ok')
        for route in ('/','/register','/login','/app.js','/style.css','/assets/example.js','/data/portal.json'):
            with self.subTest(route=route), self.assertRaises(urllib.error.HTTPError) as error:
                urllib.request.urlopen(self.base+route)
            self.assertEqual(error.exception.code,404)
            error.exception.close()

    def test_unallocated_legacy_stock_can_only_be_allocated_once(self):
        from datetime import timedelta
        from app.pharmacy import today
        with self.store.transaction() as data:
            data['products'][0]['unallocated_stock']=5
        body=dict(product_id='med01',batch_number='HISTORICAL-001',manufacturing_date=(today()-timedelta(days=30)).isoformat(),expiry_date=(today()+timedelta(days=400)).isoformat(),stock=5,mrp=3300,purchase_price=1700,source='unallocated')
        self.assertEqual(self.distributor.request('/api/batches',body)[0],200)
        self.assertEqual(self.admin.state()['products'][0]['unallocated_stock'],0)
        self.assertEqual(self.admin.state()['products'][0]['stock'],185)
        self.assertEqual(self.distributor.request('/api/batches',dict(body,batch_number='HISTORICAL-002'))[0],409)
        self.assertEqual(self.admin.state()['products'][0]['stock'],185)

    def test_dispatch_rechecks_expiry_after_reservation(self):
        from datetime import timedelta
        from app.pharmacy import today
        _,order=self.place(quantity=1)
        self.transition(self.distributor,order,'confirmed')
        self.transition(self.distributor,order,'packed')
        with self.store.transaction() as data:
            data['products'][0]['batches'][0]['expiry_date']=(today()-timedelta(days=1)).isoformat()
        self.assertEqual(self.transition(self.distributor,order,'out_for_delivery',driver_id='delivery')[0],409)
        self.assertEqual(self.transition(self.retailer,order,'cancelled')[0],409)
        self.assertEqual(self.transition(self.distributor,order,'cancelled')[0],200)
        product=self.admin.state()['products'][0]
        self.assertEqual((product['stock'],product['expired_stock']),(0,180))

if __name__=='__main__': unittest.main()
