-- Initial Schema for Callbite Customer Management Portal (Callbite Esim)

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'SUPPORT_STAFF')),
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    avatar_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    whatsapp_number TEXT NOT NULL,
    phone_number TEXT,
    email TEXT,
    country TEXT,
    city TEXT,
    source TEXT NOT NULL DEFAULT 'WhatsApp',
    referred_by_customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'VIP', 'Blocked')),
    assigned_staff_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    internal_notes TEXT,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_activity_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    description TEXT
);

CREATE TABLE IF NOT EXISTS customer_tags (
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    tag_name TEXT NOT NULL,
    PRIMARY KEY (customer_id, tag_name)
);

CREATE TABLE IF NOT EXISTS esim_providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    country_coverage TEXT NOT NULL,
    network_types TEXT NOT NULL DEFAULT '5G / 4G LTE',
    portal_url TEXT,
    support_email TEXT,
    support_phone TEXT,
    account_manager TEXT,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Maintenance')),
    integration_type TEXT NOT NULL DEFAULT 'Manual Wholesale Portal',
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS packages (
    id TEXT PRIMARY KEY,
    country_region TEXT NOT NULL,
    package_name TEXT NOT NULL,
    data_allowance TEXT NOT NULL,
    duration TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_id TEXT REFERENCES esim_providers(id) ON DELETE SET NULL,
    selling_price REAL NOT NULL DEFAULT 0,
    cost_price REAL NOT NULL DEFAULT 0,
    profit REAL NOT NULL DEFAULT 0,
    features TEXT,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS esims (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    iccid TEXT NOT NULL UNIQUE,
    country_region TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_id TEXT REFERENCES esim_providers(id) ON DELETE SET NULL,
    package_name TEXT NOT NULL,
    package_id TEXT REFERENCES packages(id) ON DELETE SET NULL,
    data_allowance TEXT NOT NULL,
    duration TEXT NOT NULL,
    start_date TEXT,
    expiry_date TEXT NOT NULL,
    renewal_date TEXT,
    activation_date TEXT,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Pending', 'Active', 'Expired', 'Suspended', 'Cancelled')),
    qr_code_data TEXT,
    apn_info TEXT,
    tag TEXT, -- eSIM specific tag (e.g. Primary SIM, Data Roaming, Umrah Special)
    notes TEXT,
    data_left_mb REAL,
    data_package_mb REAL,
    data_used_mb REAL,
    created_by_staff_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    esim_id TEXT REFERENCES esims(id) ON DELETE SET NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('New eSIM', 'Renewal', 'Package Upgrade', 'Package Change', 'Refund', 'Adjustment')),
    package_name TEXT,
    data_allowance TEXT,
    duration TEXT,
    date TEXT NOT NULL,
    selling_price REAL NOT NULL DEFAULT 0,
    cost_price REAL NOT NULL DEFAULT 0,
    profit REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'PKR',
    payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'Bank Transfer', 'Easypaisa', 'JazzCash', 'Card', 'Other')),
    payment_status TEXT NOT NULL DEFAULT 'Paid' CHECK (payment_status IN ('Paid', 'Pending', 'Partially Paid', 'Refunded', 'Cancelled')),
    staff_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    reference_id TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS support_tickets (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    esim_id TEXT REFERENCES esims(id) ON DELETE SET NULL,
    issue_type TEXT NOT NULL CHECK (issue_type IN ('Renewal', 'eSIM Not Working', 'Installation', 'Data Issue', 'Package Inquiry', 'Activation Issue', 'Refund', 'Other')),
    priority TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent')),
    status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Waiting for Customer', 'Resolved', 'Closed')),
    assigned_staff_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    resolution TEXT,
    internal_notes TEXT,
    resolved_date TEXT,
    created_by_staff_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS interactions (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    staff_id TEXT NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    contact_type TEXT NOT NULL CHECK (contact_type IN ('WhatsApp', 'Phone Call', 'SMS', 'Other')),
    purpose TEXT,
    notes TEXT NOT NULL,
    outcome TEXT,
    interaction_date TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    esim_id TEXT REFERENCES esims(id) ON DELETE SET NULL,
    task_type TEXT NOT NULL CHECK (task_type IN ('Renewal Follow-up', 'Customer Follow-up', 'Payment Follow-up', 'Support Follow-up', 'Other')),
    due_date TEXT NOT NULL,
    due_time TEXT,
    assigned_staff_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    priority TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent')),
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Overdue')),
    notes TEXT NOT NULL,
    completed_at TEXT,
    created_by_staff_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    staff_id TEXT NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    title TEXT,
    content TEXT NOT NULL,
    is_pinned INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity_timeline (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    staff_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    metadata_json TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    staff_name TEXT NOT NULL,
    action TEXT NOT NULL,
    record_type TEXT NOT NULL,
    record_id TEXT NOT NULL,
    previous_value_json TEXT,
    new_value_json TEXT,
    change_summary TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS package_presets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    country_region TEXT NOT NULL,
    package_name TEXT NOT NULL,
    data_allowance TEXT NOT NULL,
    duration TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_id TEXT REFERENCES esim_providers(id) ON DELETE SET NULL,
    default_selling_price REAL NOT NULL DEFAULT 0,
    default_cost_price REAL NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS referral_requests (
    id TEXT PRIMARY KEY,
    friend_name TEXT NOT NULL,
    friend_whatsapp TEXT NOT NULL,
    friend_phone_model TEXT,
    notes TEXT,
    referrer_name TEXT,
    referrer_phone TEXT,
    referrer_email TEXT,
    source TEXT NOT NULL DEFAULT 'pak-tel.com',
    status TEXT NOT NULL DEFAULT 'New',
    converted_customer_id TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS yesim_api_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    staff_name TEXT,
    action TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    request_params_json TEXT,
    response_json TEXT,
    status_code INTEGER,
    success INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS yesim_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    yesim_id TEXT,
    iccid TEXT UNIQUE,
    yesim_user_id TEXT,
    email TEXT,
    qrcode TEXT,
    imsi TEXT,
    msisdn TEXT,
    status_qr TEXT,
    active_plan_id TEXT,
    plan_activated_at TEXT,
    plan_expired_at TEXT,
    data_left_mb REAL,
    data_package_mb REAL,
    data_used_mb REAL,
    ios_tap_link TEXT,
    raw_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Indices for rapid search and foreign key lookups
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(whatsapp_number, phone_number);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_esims_customer ON esims(customer_id);
CREATE INDEX IF NOT EXISTS idx_esims_iccid ON esims(iccid);
CREATE INDEX IF NOT EXISTS idx_esims_expiry ON esims(expiry_date);
CREATE INDEX IF NOT EXISTS idx_esims_status ON esims(status);
CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_support_customer ON support_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_support_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date, status);
CREATE INDEX IF NOT EXISTS idx_activity_customer ON activity_timeline(customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_yesim_logs_created ON yesim_api_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_yesim_profiles_iccid ON yesim_profiles(iccid);
