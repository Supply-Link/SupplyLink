"""Persistence selection, seed data, and the isolated JSON-file test adapter."""
import copy
try:
    import fcntl
except ImportError:  # Windows development/test adapter
    fcntl = None
    import msvcrt
import json
import os
import tempfile
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import secrets
from app.catalog import medicine_products
from app.pharmacy import migrate


def now():
    return datetime.now(timezone.utc).isoformat()


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), 240000).hex()
    return salt + ':' + digest


def verify_password(password, stored):
    return secrets.compare_digest(password_hash(password, stored.split(':')[0]), stored)


def seed():
    users = [
        dict(id='admin', name='Aditi Sharma', business='SupplyLink Operations', role='admin', email='admin@supplylink.local'),
        dict(id='distributor', name='Vikram Mehta', business='Metro Pharma Distributors', role='distributor', email='distributor@supplylink.local'),
        dict(id='retailer', name='Priya Patel', business='Patel Pharmacy', role='retailer', email='retailer@supplylink.local', credit_limit=10000000, credit_used=0, address='24 Market Road, Bengaluru'),
        dict(id='retailer2', name='Arjun Rao', business='Rao Medicals', role='retailer', email='retailer2@supplylink.local', credit_limit=5000000, credit_used=0, address='18 Lake View, Bengaluru'),
        dict(id='delivery', name='Rahul Kumar', business='Delivery Partner', role='delivery', email='delivery@supplylink.local'),
    ]
    for u in users:
        u['password'] = password_hash('Demo@123')
        u['active'] = True
    products = medicine_products()
    data = dict(version=3, users=users, products=products, orders=[], payments=[], notifications=[], sessions=[], audit=[], pricing={'bulk_min': 10, 'bulk_discount_bps': 500}, created_at=now())
    migrate(data)
    return data


class JsonFileStore:
    """Legacy-compatible local adapter used by isolated tests and QA fixtures."""

    kind = 'json-file'

    def __init__(self, path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock()
        with self.transaction() as data:
            if not data:
                data.update(seed())
            elif data.get('version', 1) < 3:
                backups = self.path.parent / 'backups'
                backups.mkdir(exist_ok=True)
                backup = backups / (self.path.stem + '-before-batches-' + datetime.now().strftime('%Y%m%d-%H%M%S-%f') + '.json')
                fd = os.open(str(backup), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                with os.fdopen(fd, 'w') as file:
                    json.dump(data, file, indent=2)
                    file.flush()
                    os.fsync(file.fileno())
                migrate(data)

    def _save(self, data):
        fd, name = tempfile.mkstemp(prefix='.supplylink-', dir=self.path.parent)
        try:
            with os.fdopen(fd, 'w') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                f.flush()
                os.fsync(f.fileno())
            os.chmod(name, 0o600)
            os.replace(name, self.path)
            if os.name != "nt":
                directory = os.open(str(self.path.parent), os.O_RDONLY)
                try:
                    os.fsync(directory)
                finally:
                    os.close(directory)
        finally:
            if os.path.exists(name):
                os.unlink(name)

    @contextmanager
    def transaction(self):
        with self.lock, open(str(self.path) + '.lock', 'a+') as lockfile:
            if fcntl:
                fcntl.flock(lockfile, fcntl.LOCK_EX)
            else:
                if os.fstat(lockfile.fileno()).st_size == 0:
                    lockfile.write('0')
                    lockfile.flush()
                lockfile.seek(0)
                msvcrt.locking(lockfile.fileno(), msvcrt.LK_LOCK, 1)
            try:
                if self.path.exists():
                    with self.path.open() as f:
                        data = json.load(f)
                else:
                    data = {}
                before = copy.deepcopy(data)
                yield data
                if data != before:
                    self._save(data)
            finally:
                if fcntl:
                    fcntl.flock(lockfile, fcntl.LOCK_UN)
                else:
                    lockfile.seek(0)
                    msvcrt.locking(lockfile.fileno(), msvcrt.LK_UNLCK, 1)


class Store:
    """Select normalized PostgreSQL or the file adapter used by tests."""

    def __new__(cls, location):
        value = str(location)
        if value.startswith(('postgresql://', 'postgres://')):
            try:
                from .relational_store import RelationalPostgresStore
            except ImportError as error:
                raise RuntimeError(
                    'PostgreSQL support is not installed. Run: '
                    'python3 -m pip install -r requirements.txt'
                ) from error
            return RelationalPostgresStore(value, seed)
        return JsonFileStore(location)
