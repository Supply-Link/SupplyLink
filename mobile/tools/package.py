#!/usr/bin/env python3
"""Package evaluated debug APKs and Android sources without local settings or keys."""
from pathlib import Path
import hashlib
import shutil
import zipfile

root = Path(__file__).resolve().parents[1]
dist = root / 'dist'
dist.mkdir(exist_ok=True)
for role in ('retailer', 'delivery'):
    apk = root / f'app/build/outputs/apk/{role}/debug/app-{role}-debug.apk'
    if not apk.exists():
        raise SystemExit(f'Build both debug variants first: missing {apk.name}')
    shutil.copyfile(apk, dist / f'SupplyLink-{role.title()}-debug.apk')

install = '''SupplyLink Android 1.0.0 — evaluation builds

Android 8.0+ is required. These two APKs are signed with a development certificate.
Install the Retailer APK for pharmacy users and Delivery APK for delivery users.
Administrator and distributor users use the existing web portal.

These clients require the existing SupplyLink backend; they contain no database,
commercial licence or licence issuer key. The installation's software expiry
remains UNCONFIGURED, so only login/logout are enabled until distribution.

Emulator server URL: http://10.0.2.2:8000
USB-connected phone: adb reverse tcp:8000 tcp:8000
Then use server URL http://127.0.0.1:8000 on the phone.
Remote deployments: use a trusted HTTPS origin, without a path or /api suffix.
Only emulator/localhost HTTP is permitted by these debug builds.

Demo accounts: retailer@supplylink.local / delivery@supplylink.local
Demo password: Demo@123
New accounts require administrator approval. Replace demo credentials for real use.

Release builds enforce HTTPS and must be signed with your own Android app key.
Read the project's README.md Native Android apps section for build and QA steps.
The source ZIP contains Android clients only; the Python backend remains in the
parent SupplyLink project.
'''
(dist / 'INSTALL.txt').write_text(install)
paths = [root / p for p in ('build.gradle','settings.gradle','gradle.properties','gradlew','gradlew.bat','app/build.gradle')]
paths += list((root / 'gradle/wrapper').glob('*'))
paths += [p for p in (root / 'app/src').rglob('*') if p.is_file() and p.suffix in ('.xml','.java')]
paths += [p for p in (root / 'tools').glob('*.py')]
with zipfile.ZipFile(dist / 'SupplyLink-Android-source.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(paths):
        archive.write(path, 'mobile/' + str(path.relative_to(root)))
    archive.writestr('mobile/INSTALL.txt', install)
    archive.writestr('README.md', (root.parent / 'README.md').read_text())
files = sorted(p for p in dist.iterdir() if p.suffix in ('.apk', '.zip'))
(dist / 'SHA256SUMS.txt').write_text(''.join(f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n' for p in files))
print('\n'.join(p.name for p in files))
