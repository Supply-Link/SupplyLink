#!/usr/bin/env python3
"""Distributor-side licence provisioning. Never ship the issuer's private key."""
import argparse
import json
from pathlib import Path
from app.licensing import DEFAULT_LICENSE, DEFAULT_PUBLIC_KEY, LicenseStore, create_issuer, issue_license


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    init = commands.add_parser('init-issuer', help='Create an offline signing key and the app verification key once.')
    init.add_argument('--issuer-dir', required=True, help='Secure directory outside the distributed application.')
    init.add_argument('--public-key', default=str(DEFAULT_PUBLIC_KEY))
    issue = commands.add_parser('issue', help='Set or renew the software expiry date by signing a replacement licence.')
    issue.add_argument('--private-key', required=True)
    issue.add_argument('--expires', required=True, help='YYYY-MM-DD; valid through that day in India time.')
    issue.add_argument('--customer', default='')
    issue.add_argument('--output', default=str(DEFAULT_LICENSE))
    status = commands.add_parser('status', help='Read verified expiry status without displaying secrets.')
    status.add_argument('--license-file', default=str(DEFAULT_LICENSE))
    status.add_argument('--public-key', default=str(DEFAULT_PUBLIC_KEY))
    args = parser.parse_args()
    try:
        if args.command == 'init-issuer':
            project = Path(__file__).resolve().parent
            issuer = Path(args.issuer_dir).resolve()
            if issuer == project or project in issuer.parents:
                raise ValueError('Keep the issuer directory outside the application folder so its private key is not distributed.')
            private = create_issuer(issuer, args.public_key)
            print('Issuer created. Keep this key private and backed up: ' + str(private))
            print('Distribute only the verification key and signed licence with the application.')
        elif args.command == 'issue':
            payload = issue_license(args.private_key, args.output, args.expires, args.customer)
            print('Signed licence saved. Valid through ' + payload['expires_on'] + ' (Asia/Kolkata).')
            print('The running portal detects this file update without a restart.')
        else:
            print(json.dumps(LicenseStore(args.license_file, args.public_key).status(), indent=2))
    except (ValueError, OSError) as error:
        parser.exit(1, str(error) + '\n')


if __name__ == '__main__':
    main()
