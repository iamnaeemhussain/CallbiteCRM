-- ====================================================================
-- CALLBITE ESIM — CLEAN PRODUCTION DATABASE INITIALIZATION
-- Paste this entire SQL into Cloudflare D1 Console & Click Execute!
-- ====================================================================

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
    tag TEXT,
    notes TEXT,
    created_by_staff_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    esim_id TEXT REFERENCES esims(id) ON DELETE SET NULL,
    transaction_type TEXT NOT NULL,
    package_name TEXT,
    data_allowance TEXT,
    duration TEXT,
    date TEXT NOT NULL,
    selling_price REAL NOT NULL DEFAULT 0,
    cost_price REAL NOT NULL DEFAULT 0,
    profit REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'PKR',
    payment_method TEXT NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'Paid',
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
    issue_type TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'Normal',
    status TEXT NOT NULL DEFAULT 'Open',
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
    contact_type TEXT NOT NULL,
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
    task_type TEXT NOT NULL,
    due_date TEXT NOT NULL,
    due_time TEXT,
    assigned_staff_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    priority TEXT NOT NULL DEFAULT 'Normal',
    status TEXT NOT NULL DEFAULT 'Pending',
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

CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- Admin & Staff Logins
INSERT OR REPLACE INTO users (id, name, email, password, role, phone, status, avatar_url, created_at, updated_at, last_login_at) VALUES
('STF-001', 'System Admin', 'Admin@callbite.com', 'Touch@11223', 'ADMIN', '+923000000001', 'active', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z', '2026-08-23T08:00:00Z'),
('STF-002', 'Naeem Hussain', 'Naeem@callbite.com', 'Touch@11223', 'ADMIN', '+923000000002', 'active', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z', '2026-08-23T08:00:00Z'),
('STF-003', 'Operations Admin', 'aaa@callbite.com', 'Touch@786', 'ADMIN', '+923000000003', 'active', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z', '2026-08-23T08:00:00Z'),
('STF-004', 'Sara Khan', 'sara.khan@callbite.com', 'Support@123', 'SUPPORT_STAFF', '+923011112233', 'active', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', '2026-02-15T00:00:00Z', '2026-08-23T00:00:00Z', '2026-08-23T07:10:00Z'),
('STF-005', 'Ali Raza', 'ali.raza@callbite.com', 'Support@123', 'SUPPORT_STAFF', '+923022223344', 'active', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150', '2026-03-01T00:00:00Z', '2026-08-23T00:00:00Z', '2026-08-23T05:40:00Z');

-- Default Settings & Tags
INSERT OR REPLACE INTO settings (key, value, description, updated_at) VALUES
('company_name', 'Callbite Esim', 'Portal branding name', '2026-08-23T00:00:00Z'),
('currency_symbol', 'Rs.', 'Default display currency symbol (PKR)', '2026-08-23T00:00:00Z'),
('currency_code', 'PKR', 'Default currency code', '2026-08-23T00:00:00Z'),
('support_phone', '+923001234567', 'Official WhatsApp support contact', '2026-08-23T00:00:00Z'),
('wa_template_renewal', 'Hello {customer_name}! Your {package_name} eSIM ({iccid}) is expiring on {expiry_date}. Would you like to renew it today for {selling_price} to stay connected seamlessly? Reply to confirm!', 'Template for renewal prompt', '2026-08-23T00:00:00Z'),
('wa_template_expiry', 'Hi {customer_name}, friendly reminder from Callbite Esim that your eSIM plan will expire on {expiry_date}. Please contact us if you need more data or extension.', 'Template for expiry alert', '2026-08-23T00:00:00Z'),
('wa_template_confirmation', 'Thank you {customer_name}! Your eSIM renewal for {package_name} has been processed successfully. Your new expiry date is {expiry_date}. Safe travels!', 'Template for renewal success', '2026-08-23T00:00:00Z'),
('wa_template_support', 'Hi {customer_name}, thank you for reaching out to Callbite Esim support regarding ticket #{ticket_id}. Our team is actively on it and will update you shortly.', 'Template for support response', '2026-08-23T00:00:00Z');

INSERT OR REPLACE INTO tags (id, name, color, description) VALUES
(1, 'VIP', '#8b5cf6', 'High volume and priority customer'),
(2, 'Frequent Buyer', '#3b82f6', 'Regular recurring purchases'),
(3, 'Instagram', '#ec4899', 'Acquired via Instagram Direct/Ads'),
(4, 'Facebook', '#2563eb', 'Acquired via Facebook campaign'),
(5, 'TikTok', '#000000', 'Acquired via TikTok viral/leads'),
(6, 'Referral', '#10b981', 'Referred by existing happy customer'),
(7, 'Business', '#6366f1', 'Corporate or frequent business traveler'),
(8, 'High Value', '#f59e0b', 'High cumulative lifetime value'),
(9, 'Needs Follow-up', '#ef4444', 'Requires staff attention or check-in'),
(10, 'Returning Customer', '#06b6d4', 'Has renewed or bought secondary eSIM');
