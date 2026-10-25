#!/usr/bin/env python3
"""Import a legacy SupplyLink JSON data file into normalized PostgreSQL tables."""
import argparse
import json
import os
from pathlib import Path

from dotenv import load_dotenv

from app.models.store import Store


ROOT = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('file', type=Path, help='Legacy portal.json file')
    parser.add_argument(
        '--replace',
        action='store_true',
        help='Confirm replacement of current relational business data',
    )
    args = parser.parse_args()
    if not args.replace:
        parser.error('--replace is required; the current database is backed up first')
    load_dotenv(ROOT / '.env')
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        parser.error('DATABASE_URL is required in .env or the process environment')
    with args.file.open() as source:
        data = json.load(source)
    store = Store(database_url)
    try:
        store.import_state(data, 'JSON import: ' + args.file.name)
    finally:
        store.close()
    print(
        'Imported %d users, %d products, %d orders, and %d payments.'
        % (
            len(data.get('users', [])),
            len(data.get('products', [])),
            len(data.get('orders', [])),
            len(data.get('payments', [])),
        )
    )


if __name__ == '__main__':
    main()
