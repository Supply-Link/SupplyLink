"""Transport-independent portal use cases and transaction boundary."""
import hashlib
import secrets
import threading
import time

from app.auth.directory import authenticate, enabled
from app.models.domain import Problem, require, safe_user
from app.services.ports import LocalOperations


class PortalService:
    def __init__(self, store, license_store, operations=None):
        self.store = store
        self.license_store = license_store
        self.operations = operations or LocalOperations()
        self.ldap_url = None
        self.attempts = {}
        self.attempt_lock = threading.Lock()

    def license(self):
        return self.license_store.status()

    def health(self):
        return dict(status='ok', storage=self.store.kind)

    def require_license(self):
        status = self.license()
        if not status['usable']:
            message = 'The software licence has expired. Only sign-in and sign-out are available.' if status['status'] == 'expired' else 'A valid software licence is required. Only sign-in and sign-out are available.'
            error = Problem(message, 423)
            error.license_status = status
            raise error
        return status

    def _session(self, data, token):
        require(bool(token), 'Please sign in.', 401)
        digest = hashlib.sha256(token.encode()).hexdigest()
        session = next((item for item in data['sessions'] if secrets.compare_digest(item['token_hash'], digest) and item['expires'] > time.time()), None)
        require(session is not None, 'Your session has expired. Please sign in.', 401)
        user = next((item for item in data['users'] if item['id'] == session['user_id'] and enabled(item)), None)
        require(user is not None, 'Account is unavailable.', 401)
        return session, user

    def _auth_response(self, user, session):
        status = self.license()
        visible = safe_user(user) if status['usable'] else {key: user[key] for key in ('id', 'name', 'role')}
        return dict(user=visible, csrf=session['csrf'], license=status)

    def me(self, token):
        with self.store.transaction() as data:
            session, user = self._session(data, token)
            return self._auth_response(user, session)

    def state(self, token):
        with self.store.transaction() as data:
            _, user = self._session(data, token)
            self.require_license()
            result = self.operations.snapshot(data, user)
            result['directory'].update(listener_enabled=bool(self.ldap_url), url=self.ldap_url)
            return result

    def page(self, token, page):
        from app.models.pages import PAGE_ROLES
        from app.models.page_data import page_data
        with self.store.transaction() as data:
            _, user = self._session(data, token)
            self.require_license()
            require(page in PAGE_ROLES, 'Page not found.', 404)
            require(user['role'] in PAGE_ROLES[page], 'Your role cannot access this page.', 403)
            return page_data(data, user, page, self.ldap_url)

    def _rate_limit(self, ip):
        with self.attempt_lock:
            recent = [at for at in self.attempts.get(ip, []) if at > time.time() - 60]
            require(len(recent) < 15, 'Too many sign-in attempts. Try again in a minute.', 429)
            recent.append(time.time())
            self.attempts[ip] = recent

    def command(self, path, body, token, csrf, key, ip):
        if path not in ('/api/login', '/api/logout'):
            self.require_license()
        with self.store.transaction() as data:
            if path in ('/api/login', '/api/register'):
                self._rate_limit(ip)
                if path == '/api/register':
                    result = self.operations.register(data, body)
                else:
                    email, password = body.get('email'), body.get('password')
                    require(isinstance(email, str) and isinstance(password, str) and len(password) <= 128,
                            'Email and password are required.')
                    user = authenticate(data['users'], email, password)
                    require(user is not None, 'Email or password is incorrect.', 401)
                    token = secrets.token_urlsafe(32)
                    session = dict(token_hash=hashlib.sha256(token.encode()).hexdigest(), csrf=secrets.token_urlsafe(24), user_id=user['id'], expires=time.time() + 43200)
                    data['sessions'] = [item for item in data['sessions'] if item['expires'] > time.time()]
                    data['sessions'].append(session)
                    result = self._auth_response(user, session)
                    result['_session_token'] = token
            else:
                session, user = self._session(data, token)
                if path == '/api/logout':
                    # Logout only destroys the caller's own cookie session. Requiring
                    # CSRF here can leave a stale cookie behind after token refreshes.
                    data['sessions'].remove(session)
                    result = dict(ok=True, _clear_cookie=True)
                else:
                    require(secrets.compare_digest(csrf, session['csrf']), 'Invalid session token. Refresh and try again.', 403)
                    self.require_license()
                    result = self.operations.mutate(data, user, path, body, key)
            if path not in ('/api/login', '/api/logout'):
                self.require_license()
            return result
