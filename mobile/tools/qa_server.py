#!/usr/bin/env python3
"""Disposable Android test backends; never touches the installed licence or data."""
import sys
import tempfile
import threading
from pathlib import Path
import uvicorn
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'backend'))
from app.controllers.http import create_app
from app.services.portal import PortalService
from app.models.store import Store
from app.infrastructure.licensing import LicenseStore, create_issuer, issue_license

with tempfile.TemporaryDirectory(prefix='supplylink-android-qa-') as temporary:
    root = Path(temporary)
    public = root / 'public.pem'
    private = create_issuer(root / 'issuer', public)
    servers = []
    for port, mode in [(18001, 'active'), (18002, 'unconfigured'), (18003, 'expired'), (18004, 'active-delivery')]:
        path = root / mode / 'secrets' / 'license.json'
        if mode != 'unconfigured':
            issue_license(private, path, '2099-12-31' if mode.startswith('active') else '2020-01-01', 'Disposable Android QA fixture')
        portal = PortalService(Store(root / mode / 'portal.json'), LicenseStore(path, public))
        server = uvicorn.Server(uvicorn.Config(create_app(portal), host='127.0.0.1', port=port, log_level='warning'))
        thread = threading.Thread(target=server.run, daemon=True)
        servers.append((server, thread))
        thread.start()
        print(f'Android QA: localhost:{port} ({mode})', flush=True)
    try:
        threading.Event().wait()
    except KeyboardInterrupt:
        pass
    finally:
        for server, thread in servers:
            server.should_exit = True
            thread.join(timeout=5)
