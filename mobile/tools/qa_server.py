#!/usr/bin/env python3
"""Disposable Android test backends; never touches the installed licence or data."""
import sys
import tempfile
import threading
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'backend'))
from server import PortalServer
from app.store import Store
from app.licensing import LicenseStore, create_issuer, issue_license

with tempfile.TemporaryDirectory(prefix='supplylink-android-qa-') as temporary:
    root = Path(temporary)
    public = root / 'public.pem'
    private = create_issuer(root / 'issuer', public)
    servers = []
    for port, mode in [(18001, 'active'), (18002, 'unconfigured'), (18003, 'expired'), (18004, 'active-delivery')]:
        path = root / mode / 'secrets' / 'license.json'
        if mode != 'unconfigured':
            issue_license(private, path, '2099-12-31' if mode.startswith('active') else '2020-01-01', 'Disposable Android QA fixture')
        server = PortalServer(('127.0.0.1', port), Store(root / mode / 'portal.json'), LicenseStore(path, public))
        server.RequestHandlerClass.log_message = lambda *args: None
        servers.append(server)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        print(f'Android QA: localhost:{port} ({mode})', flush=True)
    try:
        threading.Event().wait()
    except KeyboardInterrupt:
        pass
    finally:
        for server in servers:
            server.shutdown()
            server.server_close()
