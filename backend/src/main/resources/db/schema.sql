-- Rename the first normalized schema in place. PostgreSQL preserves rows,
-- foreign keys, indexes, and RLS settings during table renames.
DO $rename_tables$
DECLARE
    old_name TEXT;
    new_name TEXT;
BEGIN
    FOR old_name, new_name IN
        SELECT * FROM (VALUES
            ('sl_meta', 'app_metadata'),
            ('sl_users', 'users'),
            ('sl_products', 'products'),
            ('sl_batches', 'batches'),
            ('sl_orders', 'orders'),
            ('sl_order_parties', 'order_parties'),
            ('sl_order_lines', 'order_lines'),
            ('sl_order_batch_allocations', 'order_batch_allocations'),
            ('sl_order_history', 'order_history'),
            ('sl_tracking_points', 'tracking_points'),
            ('sl_payments', 'payments'),
            ('sl_notifications', 'notifications'),
            ('sl_sessions', 'sessions'),
            ('sl_audit_events', 'audit_events'),
            ('sl_pricing', 'pricing'),
            ('sl_migration_backups', 'migration_backups')
        ) AS names(old_name, new_name)
    LOOP
        IF to_regclass('public.' || old_name) IS NOT NULL THEN
            IF to_regclass('public.' || new_name) IS NOT NULL THEN
                RAISE EXCEPTION 'Cannot rename %: destination % already exists', old_name, new_name;
            END IF;
            EXECUTE format('ALTER TABLE public.%I RENAME TO %I', old_name, new_name);
        END IF;
    END LOOP;
END
$rename_tables$;

CREATE TABLE IF NOT EXISTS app_metadata (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    data_version INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    sort_order INTEGER NOT NULL,
    name TEXT NOT NULL,
    business TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'distributor', 'retailer', 'delivery')),
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT FALSE,
    requested_role TEXT CHECK (requested_role IS NULL OR requested_role IN ('admin', 'distributor', 'retailer', 'delivery')),
    approval_status TEXT NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    registered_at TIMESTAMPTZ,
    reviewed_by TEXT REFERENCES users(id) DEFERRABLE INITIALLY DEFERRED,
    reviewed_at TIMESTAMPTZ,
    review_reason TEXT,
    credit_limit BIGINT CHECK (credit_limit IS NULL OR credit_limit >= 0),
    credit_used BIGINT CHECK (credit_used IS NULL OR credit_used >= 0),
    address TEXT,
    state_code TEXT,
    gstin TEXT,
    legal_name TEXT,
    drug_license TEXT,
    extra JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE UNIQUE INDEX IF NOT EXISTS sl_users_email_lower_uq
    ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS sl_users_role_active_idx
    ON users (role, active);
CREATE INDEX IF NOT EXISTS sl_users_approval_idx
    ON users (approval_status);

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    sort_order INTEGER NOT NULL,
    distributor_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    generic_name TEXT,
    strength TEXT,
    dosage_form TEXT,
    brand TEXT NOT NULL,
    category TEXT NOT NULL,
    sku TEXT NOT NULL,
    unit TEXT NOT NULL,
    price BIGINT NOT NULL CHECK (price > 0),
    stock BIGINT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    unallocated_stock BIGINT NOT NULL DEFAULT 0 CHECK (unallocated_stock >= 0),
    has_unallocated_stock BOOLEAN NOT NULL DEFAULT FALSE,
    reorder_level BIGINT NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
    artwork TEXT,
    color TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    reference_url TEXT,
    manufacturer TEXT,
    hsn_code TEXT,
    gst_rate_bps INTEGER CHECK (gst_rate_bps IS NULL OR gst_rate_bps BETWEEN 0 AND 4000),
    storage_conditions TEXT,
    has_batches BOOLEAN NOT NULL DEFAULT TRUE,
    extra JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE UNIQUE INDEX IF NOT EXISTS sl_products_sku_lower_uq
    ON products (LOWER(sku));
CREATE INDEX IF NOT EXISTS sl_products_distributor_idx
    ON products (distributor_id);
CREATE INDEX IF NOT EXISTS sl_products_active_category_idx
    ON products (active, category);

CREATE TABLE IF NOT EXISTS batches (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL,
    batch_number TEXT NOT NULL,
    manufacturing_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    stock BIGINT NOT NULL CHECK (stock >= 0),
    mrp BIGINT NOT NULL CHECK (mrp > 0),
    purchase_price BIGINT NOT NULL DEFAULT 0 CHECK (purchase_price >= 0),
    quarantined BOOLEAN NOT NULL DEFAULT FALSE,
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    extra JSONB NOT NULL DEFAULT '{}'::JSONB,
    CHECK (expiry_date > manufacturing_date),
    CHECK (purchase_price <= mrp)
);

CREATE UNIQUE INDEX IF NOT EXISTS sl_batches_product_number_lower_uq
    ON batches (product_id, LOWER(batch_number));
CREATE INDEX IF NOT EXISTS sl_batches_fefo_idx
    ON batches (product_id, expiry_date, manufacturing_date);
CREATE INDEX IF NOT EXISTS sl_batches_available_idx
    ON batches (product_id, quarantined, expiry_date) WHERE stock > 0;

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    sort_order INTEGER NOT NULL,
    number TEXT,
    retailer_id TEXT REFERENCES users(id),
    retailer_name TEXT,
    distributor_id TEXT REFERENCES users(id),
    driver_id TEXT REFERENCES users(id),
    address TEXT,
    payment_method TEXT CHECK (payment_method IS NULL OR payment_method IN ('cod', 'credit')),
    payment_status TEXT CHECK (payment_status IS NULL OR payment_status IN ('unpaid', 'paid')),
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ,
    request_key TEXT,
    supply_state_code TEXT,
    supplier_state_code TEXT,
    tax_type TEXT,
    subtotal BIGINT,
    discount BIGINT,
    taxable BIGINT,
    cgst BIGINT,
    sgst BIGINT,
    utgst BIGINT,
    igst BIGINT,
    tax BIGINT,
    total BIGINT NOT NULL,
    extra JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE UNIQUE INDEX IF NOT EXISTS sl_orders_number_uq
    ON orders (number) WHERE number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sl_orders_retailer_request_uq
    ON orders (retailer_id, request_key) WHERE request_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS sl_orders_retailer_idx ON orders (retailer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sl_orders_distributor_idx ON orders (distributor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sl_orders_driver_idx ON orders (driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sl_orders_status_idx ON orders (status, created_at DESC);

CREATE TABLE IF NOT EXISTS order_parties (
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    party_type TEXT NOT NULL CHECK (party_type IN ('supplier', 'buyer')),
    user_id TEXT,
    business TEXT,
    legal_name TEXT,
    address TEXT,
    gstin TEXT,
    state_code TEXT,
    drug_license TEXT,
    extra JSONB NOT NULL DEFAULT '{}'::JSONB,
    PRIMARY KEY (order_id, party_type)
);

CREATE TABLE IF NOT EXISTS order_lines (
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    product_id TEXT,
    name TEXT,
    unit TEXT,
    manufacturer TEXT,
    quantity BIGINT NOT NULL CHECK (quantity > 0),
    unit_price BIGINT,
    subtotal BIGINT,
    discount BIGINT,
    taxable BIGINT,
    hsn_code TEXT,
    gst_rate_bps INTEGER,
    cgst BIGINT,
    sgst BIGINT,
    utgst BIGINT,
    igst BIGINT,
    tax BIGINT,
    total BIGINT,
    extra JSONB NOT NULL DEFAULT '{}'::JSONB,
    PRIMARY KEY (order_id, line_number)
);

CREATE INDEX IF NOT EXISTS sl_order_lines_product_idx
    ON order_lines (product_id);

CREATE TABLE IF NOT EXISTS order_batch_allocations (
    order_id TEXT NOT NULL,
    line_number INTEGER NOT NULL,
    allocation_number INTEGER NOT NULL,
    batch_id TEXT,
    batch_number TEXT,
    manufacturing_date DATE,
    expiry_date DATE,
    mrp BIGINT,
    quantity BIGINT NOT NULL CHECK (quantity > 0),
    extra JSONB NOT NULL DEFAULT '{}'::JSONB,
    PRIMARY KEY (order_id, line_number, allocation_number),
    FOREIGN KEY (order_id, line_number)
        REFERENCES order_lines(order_id, line_number) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_history (
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    event_number INTEGER NOT NULL,
    status TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    actor_name TEXT NOT NULL,
    extra JSONB NOT NULL DEFAULT '{}'::JSONB,
    PRIMARY KEY (order_id, event_number)
);

CREATE TABLE IF NOT EXISTS tracking_points (
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    point_number INTEGER NOT NULL,
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    recorded_at TIMESTAMPTZ NOT NULL,
    extra JSONB NOT NULL DEFAULT '{}'::JSONB,
    PRIMARY KEY (order_id, point_number)
);

CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    sort_order INTEGER NOT NULL,
    order_id TEXT NOT NULL REFERENCES orders(id),
    order_number TEXT,
    amount BIGINT NOT NULL CHECK (amount > 0),
    reference TEXT NOT NULL,
    actor_id TEXT NOT NULL REFERENCES users(id),
    request_key TEXT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    mode TEXT NOT NULL,
    extra JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE UNIQUE INDEX IF NOT EXISTS sl_payments_actor_request_uq
    ON payments (actor_id, request_key);
CREATE UNIQUE INDEX IF NOT EXISTS sl_payments_order_uq
    ON payments (order_id);

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    sort_order INTEGER NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    extra JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS sl_notifications_user_idx
    ON notifications (user_id, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    csrf_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS sl_sessions_user_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sl_sessions_expiry_idx ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    sort_order INTEGER NOT NULL,
    actor_id TEXT,
    actor_name TEXT NOT NULL,
    action TEXT NOT NULL,
    detail TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    extra JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS sl_audit_occurred_idx
    ON audit_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS sl_audit_actor_idx
    ON audit_events (actor_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS pricing (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    bulk_min INTEGER NOT NULL CHECK (bulk_min BETWEEN 1 AND 10000),
    bulk_discount_bps INTEGER NOT NULL CHECK (bulk_discount_bps BETWEEN 0 AND 9000)
);

CREATE TABLE IF NOT EXISTS migration_backups (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source TEXT NOT NULL,
    data_version INTEGER NOT NULL,
    snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS has_unallocated_stock BOOLEAN NOT NULL DEFAULT FALSE;

DO $constraints$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sl_users_credit_within_limit_ck') THEN
        ALTER TABLE users ADD CONSTRAINT sl_users_credit_within_limit_ck
            CHECK (credit_limit IS NULL OR credit_used IS NULL OR credit_used <= credit_limit);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sl_users_approval_active_ck') THEN
        ALTER TABLE users ADD CONSTRAINT sl_users_approval_active_ck
            CHECK (approval_status = 'approved' OR NOT active);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sl_users_state_code_ck') THEN
        ALTER TABLE users ADD CONSTRAINT sl_users_state_code_ck
            CHECK (
                state_code IS NULL OR state_code IN (
                    '01','02','03','04','05','06','07','08','09','10','11','12',
                    '13','14','15','16','17','18','19','20','21','22','23','24',
                    '26','27','29','30','31','32','33','34','35','36','37','38'
                )
            );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sl_users_gstin_ck') THEN
        ALTER TABLE users ADD CONSTRAINT sl_users_gstin_ck
            CHECK (
                gstin IS NULL OR gstin = '' OR (
                    gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
                    AND state_code IS NOT NULL
                    AND LEFT(gstin, 2) = state_code
                )
            );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sl_products_hsn_ck') THEN
        ALTER TABLE products ADD CONSTRAINT sl_products_hsn_ck
            CHECK (hsn_code IS NULL OR hsn_code = '' OR hsn_code ~ '^(?:[0-9]{4}|[0-9]{6}|[0-9]{8})$');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sl_orders_status_ck') THEN
        ALTER TABLE orders ADD CONSTRAINT sl_orders_status_ck
            CHECK (status IN ('placed','confirmed','packed','out_for_delivery','delivered','cancelled'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sl_orders_money_ck') THEN
        ALTER TABLE orders ADD CONSTRAINT sl_orders_money_ck
            CHECK (
                total >= 0
                AND (subtotal IS NULL OR subtotal >= 0)
                AND (discount IS NULL OR discount >= 0)
                AND (taxable IS NULL OR taxable >= 0)
                AND (cgst IS NULL OR cgst >= 0)
                AND (sgst IS NULL OR sgst >= 0)
                AND (utgst IS NULL OR utgst >= 0)
                AND (igst IS NULL OR igst >= 0)
                AND (tax IS NULL OR tax >= 0)
            );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sl_orders_tax_type_ck') THEN
        ALTER TABLE orders ADD CONSTRAINT sl_orders_tax_type_ck
            CHECK (tax_type IS NULL OR tax_type IN ('CGST + SGST','CGST + UTGST','IGST'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sl_order_lines_money_ck') THEN
        ALTER TABLE order_lines ADD CONSTRAINT sl_order_lines_money_ck
            CHECK (
                (unit_price IS NULL OR unit_price >= 0)
                AND (subtotal IS NULL OR subtotal >= 0)
                AND (discount IS NULL OR discount >= 0)
                AND (taxable IS NULL OR taxable >= 0)
                AND (cgst IS NULL OR cgst >= 0)
                AND (sgst IS NULL OR sgst >= 0)
                AND (utgst IS NULL OR utgst >= 0)
                AND (igst IS NULL OR igst >= 0)
                AND (tax IS NULL OR tax >= 0)
                AND (total IS NULL OR total >= 0)
            );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sl_sessions_token_hash_ck') THEN
        ALTER TABLE sessions ADD CONSTRAINT sl_sessions_token_hash_ck
            CHECK (token_hash ~ '^[0-9a-f]{64}$');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sl_payments_mode_ck') THEN
        ALTER TABLE payments ADD CONSTRAINT sl_payments_mode_ck
            CHECK (mode = 'manual');
    END IF;
END
$constraints$;

CREATE UNIQUE INDEX IF NOT EXISTS sl_sessions_csrf_uq
    ON sessions (csrf_token);

-- SupplyLink data is accessed only through the Python backend. RLS is enabled
-- without anon/authenticated policies so Supabase's public Data API is denied.
-- The backend database-owner connection continues to bypass RLS.
DO $rls$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'app_metadata',
        'users',
        'products',
        'batches',
        'orders',
        'order_parties',
        'order_lines',
        'order_batch_allocations',
        'order_history',
        'tracking_points',
        'payments',
        'notifications',
        'sessions',
        'audit_events',
        'pricing',
        'migration_backups',
        'supplylink_state',
        'supplylink_state_migrations'
    ]
    LOOP
        IF to_regclass('public.' || table_name) IS NOT NULL THEN
            EXECUTE format(
                'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
                table_name
            );
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
                EXECUTE format(
                    'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon, authenticated',
                    table_name
                );
            END IF;
        END IF;
    END LOOP;
END
$rls$;

DO $sequences$
DECLARE
    sequence_name TEXT;
BEGIN
    FOREACH sequence_name IN ARRAY ARRAY[
        'migration_backups_id_seq',
        'sl_migration_backups_id_seq',
        'supplylink_state_migrations_id_seq'
    ]
    LOOP
        IF to_regclass('public.' || sequence_name) IS NOT NULL THEN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
                EXECUTE format(
                    'REVOKE ALL PRIVILEGES ON SEQUENCE public.%I FROM anon, authenticated',
                    sequence_name
                );
            END IF;
        END IF;
    END LOOP;
END
$sequences$;
