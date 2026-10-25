#!/usr/bin/env python3
"""FastAPI entry point for SupplyLink and its optional local LDAP listener."""
import argparse
import os
import ssl
import threading
from pathlib import Path

import uvicorn
from app.controllers.http import create_app
from app.ldap_server import LDAPServer
from app.licensing import DEFAULT_LICENSE, DEFAULT_PUBLIC_KEY, LicenseStore
from app.services.portal import PortalService
from app.store import Store

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

ROOT = Path(__file__).resolve().parent
if load_dotenv:
    load_dotenv(ROOT / '.env')


def create_application(database_url=None, license_file=DEFAULT_LICENSE, license_public_key=DEFAULT_PUBLIC_KEY):
    """Construct the HTTP adapter around one application service and store."""
    database_url = database_url or os.environ.get('DATABASE_URL')
    if not database_url:
        raise ValueError('DATABASE_URL is required. Add it to backend/.env or the process environment.')
    portal = PortalService(Store(database_url), LicenseStore(license_file, license_public_key))
    return create_app(portal)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--ldap-port', type=int, default=1389)
    parser.add_argument('--no-ldap', action='store_true')
    parser.add_argument('--ldap-cert')
    parser.add_argument('--ldap-key')
    parser.add_argument('--license-file', default=str(DEFAULT_LICENSE))
    parser.add_argument('--license-public-key', default=str(DEFAULT_PUBLIC_KEY))
    args = parser.parse_args()
    if bool(args.ldap_cert) != bool(args.ldap_key):
        parser.error('--ldap-cert and --ldap-key must be supplied together')
    try:
        app = create_application(license_file=args.license_file, license_public_key=args.license_public_key)
    except ValueError as error:
        parser.error(str(error))
    portal = app.state.portal
    ldap = None
    if not args.no_ldap:
        context = None
        if args.ldap_cert:
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            context.minimum_version = ssl.TLSVersion.TLSv1_2
            context.load_cert_chain(args.ldap_cert, args.ldap_key)
        try:
            ldap = LDAPServer(('127.0.0.1', args.ldap_port), portal.store, context, license_store=portal.license_store)
        except OSError:
            parser.error('LDAP port is unavailable. Choose --ldap-port or use --no-ldap.')
        portal.ldap_url = ('ldaps' if context else 'ldap') + '://127.0.0.1:' + str(ldap.server_address[1])
        threading.Thread(target=ldap.serve_forever, daemon=True).start()
    print('SupplyLink FastAPI: http://%s:%s' % (args.host, args.port), flush=True)
    try:
        uvicorn.run(app, host=args.host, port=args.port, log_level='info')
    finally:
        if ldap:
            ldap.shutdown()
            ldap.server_close()
        close_store = getattr(portal.store, 'close', None)
        if close_store:
            close_store()


if __name__ == '__main__':
    main()
