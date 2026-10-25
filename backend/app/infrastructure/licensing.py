"""Offline signed licences. Only the verification key is shipped with the portal."""
import base64
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import tempfile
import threading
from datetime import date, datetime, time, timedelta, timezone

ROOT = Path(__file__).resolve().parents[1]
INDIA = timezone(timedelta(hours=5, minutes=30))
DEFAULT_LICENSE = ROOT / '.secrets' / 'software-license.json'
DEFAULT_PUBLIC_KEY = ROOT / 'config' / 'license-public.pem'


def canonical(payload):
    return json.dumps(payload, sort_keys=True, separators=(',', ':'), ensure_ascii=True).encode()


def expiry_date(value):
    parsed = date.fromisoformat(value)
    if parsed.isoformat() != value:
        raise ValueError('Use an expiry date in YYYY-MM-DD format.')
    if parsed.year >= 9999:
        raise ValueError('Expiry year must be below 9999.')
    return parsed


def atomic_write(path, content, mode=0o600):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, temporary = tempfile.mkstemp(prefix='.license-', dir=path.parent)
    try:
        os.fchmod(fd, mode)
        with os.fdopen(fd, 'wb') as file:
            file.write(content)
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary, path)
        directory = os.open(str(path.parent), os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def openssl(arguments, data=None):
    binary = shutil.which('openssl')
    if not binary:
        raise ValueError('OpenSSL or LibreSSL is required for licence signing and verification.')
    try:
        result = subprocess.run([binary, *arguments], input=data, capture_output=True, timeout=20)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise ValueError('The licence cryptographic operation failed.') from error
    if result.returncode:
        raise ValueError('The licence key or signature could not be verified.')
    return result.stdout


def create_issuer(issuer_dir, public_key_path):
    directory = Path(issuer_dir).resolve()
    public_key_path = Path(public_key_path).resolve()
    private = directory / 'license-signing-private.pem'
    if private.exists() or public_key_path.exists():
        raise ValueError('Issuer or verification key already exists. Existing keys were not replaced.')
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(directory, 0o700)
    # The private key is produced on stdout and written with owner-only permissions.
    key = openssl(['genpkey', '-algorithm', 'RSA', '-pkeyopt', 'rsa_keygen_bits:3072'])
    atomic_write(private, key)
    public = openssl(['pkey', '-in', str(private), '-pubout'])
    atomic_write(public_key_path, public, 0o644)
    return private


def issue_license(private_key, destination, expires_on, customer=''):
    expiry_date(expires_on)
    if not isinstance(customer, str) or len(customer) > 200:
        raise ValueError('Customer must be at most 200 characters.')
    destination = Path(destination).resolve()
    private_key = Path(private_key).resolve()
    if private_key == destination:
        raise ValueError('The licence output cannot replace the private key.')
    payload = dict(version=1, product='supplylink', license_id=secrets.token_hex(16), customer=customer,
                   expires_on=expires_on, timezone='Asia/Kolkata', issued_at=datetime.now(timezone.utc).isoformat())
    signature = openssl(['dgst', '-sha256', '-sign', str(private_key)], canonical(payload))
    envelope = dict(payload=payload, signature=base64.b64encode(signature).decode())
    destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(destination.parent, 0o700)
    atomic_write(destination, json.dumps(envelope, indent=2).encode())
    return payload


class LicenseStore:
    def __init__(self, license_path=DEFAULT_LICENSE, public_key_path=DEFAULT_PUBLIC_KEY, clock=None):
        self.path = Path(license_path)
        self.public_key_path = Path(public_key_path)
        self.clock = clock or (lambda: datetime.now(timezone.utc))
        self.lock = threading.RLock()
        self._fingerprint = None
        self._payload = None

    def _verified_payload(self):
        # Re-read both files for every request. Cached signature verification never caches time validity.
        if self.path.stat().st_mode & 0o077:
            raise ValueError('Licence permissions must be owner-only.')
        if self.path.stat().st_size > 16384 or self.public_key_path.stat().st_size > 16384:
            raise ValueError('Invalid licence file size.')
        raw, public_key = self.path.read_bytes(), self.public_key_path.read_bytes()
        fingerprint = hashlib.sha256(raw + b'\0' + public_key).digest()
        if fingerprint == self._fingerprint and self._payload is not None:
            return self._payload
        envelope = json.loads(raw)
        if not isinstance(envelope, dict) or set(envelope) != {'payload', 'signature'}:
            raise ValueError('Invalid licence envelope.')
        payload = envelope['payload']
        if not isinstance(payload, dict) or payload.get('version') != 1 or payload.get('product') != 'supplylink' or payload.get('timezone') != 'Asia/Kolkata':
            raise ValueError('Invalid licence payload.')
        expiry_date(payload['expires_on'])
        signature = base64.b64decode(envelope['signature'], validate=True)
        with tempfile.TemporaryDirectory(prefix='supplylink-license-') as directory:
            key_path, signature_path = Path(directory)/'public.pem', Path(directory)/'signature.bin'
            key_path.write_bytes(public_key)
            signature_path.write_bytes(signature)
            openssl(['dgst', '-sha256', '-verify', str(key_path), '-signature', str(signature_path)], canonical(payload))
        self._fingerprint, self._payload = fingerprint, payload
        return payload

    def status(self):
        with self.lock:
            current = self.clock()
            if current.tzinfo is None:
                current = current.replace(tzinfo=timezone.utc)
            result = dict(usable=False, status='unconfigured', expires_on=None, expires_at=None,
                          timezone='Asia/Kolkata', server_time=current.isoformat())
            try:
                payload = self._verified_payload()
                cutoff = datetime.combine(expiry_date(payload['expires_on']) + timedelta(days=1), time.min, INDIA)
                usable = current < cutoff
                result.update(usable=usable, status='active' if usable else 'expired', expires_on=payload['expires_on'], expires_at=cutoff.isoformat())
            except FileNotFoundError:
                pass
            except (OSError, ValueError, TypeError, KeyError, OverflowError):
                result['status'] = 'invalid'
            return result
