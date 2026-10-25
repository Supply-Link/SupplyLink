#!/usr/bin/env python3
"""SupplyLink backend API, local LDAP directory, and PostgreSQL data store."""
import argparse
import hashlib
import json
import os
import secrets
import ssl
import threading
import time
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from app.store import Store, verify_password
from app.domain import Problem, require, mutate, snapshot, safe_user, register
from app.directory import authenticate, enabled
from app.ldap_server import LDAPServer
from app.licensing import LicenseStore, DEFAULT_LICENSE, DEFAULT_PUBLIC_KEY

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

ROOT = Path(__file__).resolve().parent
if load_dotenv:
    load_dotenv(ROOT / '.env')


class PortalServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, store, license_store=None):
        super().__init__(address, Handler)
        self.store = store
        self.license_store = license_store or LicenseStore()
        self.ldap_url = None
        self.attempts = {}
        self.attempt_lock = threading.Lock()


class Handler(BaseHTTPRequestHandler):
    server_version = 'SupplyLink/1.0'

    def send(self, status, payload, content_type='application/json; charset=utf-8', cookie=None):
        if not isinstance(payload, bytes):
            payload = json.dumps(payload, allow_nan=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Referrer-Policy', 'same-origin')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
        if cookie:
            self.send_header('Set-Cookie', cookie)
        self.cors_headers()
        self.end_headers()
        self.wfile.write(payload)

    def request_origin(self):
        origin = self.headers.get('Origin')
        if not origin:
            return None
        parsed = urlsplit(origin)
        if parsed.scheme not in ('http', 'https') or not parsed.netloc or parsed.path not in ('', '/') or parsed.username or parsed.password:
            return None
        return '%s://%s' % (parsed.scheme, parsed.netloc)

    def cors_headers(self):
        origin = self.request_origin()
        if not origin or origin not in allowed_origins():
            return
        self.send_header('Access-Control-Allow-Origin', origin)
        self.send_header('Access-Control-Allow-Credentials', 'true')
        self.send_header('Vary', 'Origin')

    def do_OPTIONS(self):
        origin = self.request_origin()
        if not origin or origin not in allowed_origins():
            self.send_response(403)
            self.send_header('Content-Length', '0')
            self.end_headers()
            return
        self.send_response(204)
        self.cors_headers()
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token, Idempotency-Key')
        self.send_header('Access-Control-Max-Age', '600')
        self.send_header('Content-Length', '0')
        self.end_headers()

    def body(self):
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            raise Problem('Invalid body length.')
        require(0 < length <= 65536, 'JSON body is required and must be below 64 KB.', 413)
        require(self.headers.get('Content-Type','').split(';')[0] == 'application/json', 'Use application/json.', 415)
        try:
            value = json.loads(self.rfile.read(length), parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
        except (ValueError, UnicodeDecodeError):
            raise Problem('Invalid JSON.')
        require(isinstance(value, dict), 'Request body must be an object.')
        return value

    def session(self, data):
        try:
            cookies = SimpleCookie(self.headers.get('Cookie',''))
            token = cookies['supplylink_session'].value
        except Exception:
            raise Problem('Please sign in.', 401)
        digest = hashlib.sha256(token.encode()).hexdigest()
        session = next((s for s in data['sessions'] if secrets.compare_digest(s['token_hash'], digest) and s['expires'] > time.time()), None)
        require(session is not None, 'Your session has expired. Please sign in.', 401)
        user = next((u for u in data['users'] if u['id'] == session['user_id'] and enabled(u)), None)
        require(user is not None, 'Account is unavailable.', 401)
        return session, user

    def same_origin(self):
        origin = self.request_origin()
        if origin and origin in allowed_origins():
            return
        if self.headers.get('Origin'):
            require(origin is not None and origin.split('://', 1)[-1] == self.headers.get('Host'), 'Cross-origin request rejected.', 403)
        require(self.headers.get('Sec-Fetch-Site') != 'cross-site', 'Cross-site request rejected.', 403)

    def require_license(self):
        status = self.server.license_store.status()
        if not status['usable']:
            message = 'The software licence has expired. Only sign-in and sign-out are available.' if status['status']=='expired' else 'A valid software licence is required. Only sign-in and sign-out are available.'
            error = Problem(message, 423)
            error.license_status = status
            raise error
        return status

    def problem(self, error):
        payload = dict(error=error.message)
        if hasattr(error, 'license_status'):
            payload.update(code='SOFTWARE_LICENSE_BLOCKED', license=error.license_status)
        self.send(error.status, payload)

    def auth_response(self, user, session):
        license_status = self.server.license_store.status()
        visible_user = safe_user(user) if license_status['usable'] else {key: user[key] for key in ('id','name','role')}
        return dict(user=visible_user, csrf=session['csrf'], license=license_status)

    def do_GET(self):
        try:
            path = urlsplit(self.path).path
            if path == '/api/license':
                return self.send(200, self.server.license_store.status())
            if path == '/api/health':
                return self.send(200, dict(status='ok', storage=self.server.store.kind))
            if path.startswith('/api/'):
                with self.server.store.transaction() as data:
                    session, user = self.session(data)
                    if path == '/api/me':
                        result = self.auth_response(user, session)
                    elif path == '/api/state':
                        self.require_license()
                        result = snapshot(data, user)
                        result['directory'].update(listener_enabled=bool(self.server.ldap_url),url=self.server.ldap_url)
                    else:
                        self.require_license()
                        raise Problem('Endpoint not found.', 404)
                return self.send(200, result)
            raise Problem('Endpoint not found.', 404)
        except Problem as error:
            self.problem(error)
        except Exception:
            self.log_error('Unexpected read failure')
            self.send(500, dict(error='Could not read data. Check the server log.'))

    def do_POST(self):
        try:
            self.same_origin()
            path = urlsplit(self.path).path
            if path not in ('/api/login','/api/logout'):
                self.require_license()
            body = self.body()
            cookie = None
            with self.server.store.transaction() as data:
                if path in ('/api/login','/api/register'):
                    ip = self.client_address[0]
                    with self.server.attempt_lock:
                        recent = [t for t in self.server.attempts.get(ip, []) if t > time.time()-60]
                        self.server.attempts[ip] = recent
                        require(len(recent) < 15, 'Too many sign-in attempts. Try again in a minute.', 429)
                        recent.append(time.time())
                    if path == '/api/register':
                        result = register(data, body)
                        # Commit through the transaction before sending a response.
                    else:
                        result = self.login(data, body)
                        cookie = result.pop('_cookie')
                else:
                    session, user = self.session(data)
                    require(secrets.compare_digest(self.headers.get('X-CSRF-Token',''), session['csrf']), 'Invalid session token. Refresh and try again.', 403)
                    if path == '/api/logout':
                        data['sessions'].remove(session)
                        cookie = session_cookie(clear=True)
                        result = dict(ok=True)
                    else:
                        self.require_license()
                        result = mutate(data, user, path, body, self.headers.get('Idempotency-Key'))
                if path not in ('/api/login','/api/logout'):
                    self.require_license()
            self.send(200, result, cookie=cookie)
        except Problem as error:
            self.problem(error)
        except Exception:
            self.log_error('Unexpected write failure; transaction rolled back')
            self.send(500, dict(error='Could not save changes. No changes were committed.'))

    def login(self, data, body):
        email, password = body.get('email'), body.get('password')
        require(isinstance(email, str) and isinstance(password, str) and len(password) <= 128, 'Email and password are required.')
        user = authenticate(data['users'], email, password)
        require(user is not None, 'Email or password is incorrect.', 401)
        token = secrets.token_urlsafe(32)
        session = dict(token_hash=hashlib.sha256(token.encode()).hexdigest(), csrf=secrets.token_urlsafe(24), user_id=user['id'], expires=time.time()+43200)
        data['sessions'] = [s for s in data['sessions'] if s['expires'] > time.time()]
        data['sessions'].append(session)
        cookie = session_cookie(token)
        result = self.auth_response(user, session)
        result['_cookie'] = cookie
        return result


def allowed_origins():
    return {item.strip().rstrip('/') for item in os.environ.get('CORS_ORIGINS', '').split(',') if item.strip()}


def session_cookie(token='', clear=False):
    max_age = '0' if clear else '43200'
    if allowed_origins():
        # A browser will only store a cookie for the API host when the page is on another host
        # if the cookie is Secure, SameSite=None, and partitioned to that page.
        extra = '; Secure; SameSite=None; Partitioned'
    else:
        extra = '; SameSite=Strict'
        if os.environ.get('COOKIE_SECURE') == '1':
            extra += '; Secure'
    return 'supplylink_session=%s; HttpOnly%s; Path=/; Max-Age=%s' % (token, extra, max_age)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--ldap-port', type=int, default=1389)
    parser.add_argument('--no-ldap', action='store_true')
    parser.add_argument('--ldap-cert', help='Optional LDAPS certificate path')
    parser.add_argument('--ldap-key', help='Optional LDAPS private key path')
    parser.add_argument('--license-file', default=str(DEFAULT_LICENSE))
    parser.add_argument('--license-public-key', default=str(DEFAULT_PUBLIC_KEY))
    args = parser.parse_args()
    if bool(args.ldap_cert) != bool(args.ldap_key):
        parser.error('--ldap-cert and --ldap-key must be supplied together')
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        parser.error('DATABASE_URL is required. Add it to .env or the process environment.')
    server = PortalServer(
        (args.host, args.port),
        Store(database_url),
        LicenseStore(args.license_file,args.license_public_key),
    )
    ldap = None
    if not args.no_ldap:
        context = None
        if args.ldap_cert:
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            context.minimum_version = ssl.TLSVersion.TLSv1_2
            context.load_cert_chain(args.ldap_cert,args.ldap_key)
        try:
            ldap = LDAPServer(('127.0.0.1',args.ldap_port),server.store,context,license_store=server.license_store)
        except OSError:
            server.server_close()
            parser.error('LDAP port is unavailable. Choose --ldap-port or use --no-ldap.')
        server.ldap_url = ('ldaps' if context else 'ldap') + '://127.0.0.1:' + str(ldap.server_address[1])
        threading.Thread(target=ldap.serve_forever,daemon=True).start()
        print(('LDAPS' if context else 'Local LDAP') + ' directory: 127.0.0.1:' + str(ldap.server_address[1]) + ' · dc=supplylink,dc=local',flush=True)
    licensing = server.license_store.status()
    print('Software licence: ' + licensing['status'] + (' · valid through '+licensing['expires_on'] if licensing['expires_on'] else ' · provision a signed licence to enable business actions'),flush=True)
    print('SupplyLink API is running at http://%s:%s' % (args.host, server.server_port), flush=True)
    print('Demo accounts: admin / distributor / retailer / delivery @supplylink.local | password: Demo@123', flush=True)
    print('Database: PostgreSQL', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nStopped.')
    finally:
        server.server_close()
        if ldap:
            ldap.shutdown()
            ldap.server_close()
        close_store = getattr(server.store, 'close', None)
        if close_store:
            close_store()


if __name__ == '__main__':
    main()
