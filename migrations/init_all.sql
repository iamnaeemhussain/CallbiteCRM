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

INSERT OR REPLACE INTO users (id, name, email, password, role, phone, status, avatar_url, created_at, updated_at, last_login_at) VALUES
('STF-001', 'System Admin', 'Admin@callbite.com', 'Touch@11223', 'ADMIN', '+923000000001', 'active', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z', '2026-08-23T08:00:00Z'),
('STF-002', 'Naeem Hussain', 'Naeem@callbite.com', 'Touch@11223', 'ADMIN', '+923000000002', 'active', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z', '2026-08-23T08:00:00Z'),
('STF-003', 'Operations Admin', 'aaa@callbite.com', 'Touch@786', 'ADMIN', '+923000000003', 'active', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z', '2026-08-23T08:00:00Z'),
('STF-004', 'Sara Khan', 'sara.khan@callbite.com', 'Support@123', 'SUPPORT_STAFF', '+923011112233', 'active', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', '2026-02-15T00:00:00Z', '2026-08-23T00:00:00Z', '2026-08-23T07:10:00Z'),
('STF-005', 'Ali Raza', 'ali.raza@callbite.com', 'Support@123', 'SUPPORT_STAFF', '+923022223344', 'active', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150', '2026-03-01T00:00:00Z', '2026-08-23T00:00:00Z', '2026-08-23T05:40:00Z');

INSERT OR REPLACE INTO esim_providers (id, name, code, country_coverage, network_types, portal_url, support_email, support_phone, account_manager, status, integration_type, notes, created_at, updated_at) VALUES
('PRV-101', 'eSIMGo Wholesale', 'ESIMGO', 'Global (160+ Countries)', '5G / 4G LTE', 'https://esimgo.com/portal', 'wholesale@esimgo.com', '+442080998877', 'David Vance', 'Active', 'API Direct / Wholesale Portal', 'Primary global supplier. SM-DP+ server: smdp.io', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z'),
('PRV-102', '1GLOBAL Roaming', '1GLOBAL', 'Europe, Americas & Asia', '5G / 4G LTE', 'https://1global.com/dashboard', 'support@1global.com', '+18005550199', 'Elena Rostova', 'Active', 'Manual Wholesale Portal', 'Tier-1 European network profiles with Orange roaming.', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z'),
('PRV-103', 'Redtea Mobile', 'REDTEA', 'Asia Pacific & Middle East', '5G / 4G LTE', 'https://redteamobile.com/partner', 'ops@redteamobile.com', '+85298765432', 'Kevin Chen', 'Active', 'Manual Portal & Batch CSV', 'High-data packages for Japan, China, UAE.', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z'),
('PRV-104', 'Turkcell Direct Wholesale', 'TURKCELL', 'Turkey & Northern Cyprus', '4.5G LTE', 'https://turkcell.com.tr/kurumsal', 'esim@turkcell.com.tr', '+905327571000', 'Murat Demir', 'Active', 'Direct Carrier Partner', 'Direct local breakout in Istanbul on Turkcell.', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z'),
('PRV-105', 'du / Etisalat UAE Partner', 'DU_ETISALAT', 'United Arab Emirates & GCC', '5G Ultra Wideband', 'https://du.ae/business/esim', 'partner@du.ae', '+97143905555', 'Rashid Al-Maktoum', 'Active', 'Direct Carrier Partner', 'Traveler packages for Dubai & Abu Dhabi with 5G speed.', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z'),
('PRV-106', 'Jazz / Zong Pakistan Hub', 'JAZZ_PK', 'Pakistan Nationwide', '4G LTE Max', 'https://jazz.com.pk/business', 'b2b@jazz.com.pk', '+923000001111', 'Kamran Sheikh', 'Active', 'Direct Carrier Partner', 'Local partner for Pakistan inbound travelers.', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z'),
('PRV-107', 'STC / Mobily Saudi Roam', 'STC_KSA', 'Saudi Arabia (Umrah/Hajj)', '5G Network', 'https://stc.com.sa/business', 'umrah-esim@stc.com.sa', '+966114555555', 'Abdullah Al-Ghamdi', 'Active', 'Direct Carrier Partner', 'Optimized for Makkah, Madinah, and Riyadh travel.', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z'),
('PRV-108', 'Gigs Global Connect', 'GIGS', 'North America & Europe', '5G / 4G LTE', 'https://gigs.com/console', 'support@gigs.com', '+14159988112', 'Sarah Miller', 'Active', 'API Direct / Reseller Console', 'High-reliability profiles for USA & Canada.', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z');

INSERT OR REPLACE INTO packages (id, country_region, package_name, data_allowance, duration, provider, provider_id, selling_price, cost_price, profit, features, status, description, created_at, updated_at) VALUES
('PKG-101', 'Pakistan', 'Pakistan 10GB Standard', '10GB', '30 Days', 'Jazz / Zong Pakistan Hub', 'PRV-106', 4500.00, 2800.00, 1700.00, '4G LTE Max, Local Data & Hotspot', 'Active', 'Nationwide coverage on Jazz & Zong network.', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z'),
('PKG-102', 'Pakistan', 'Pakistan 20GB Max', '20GB', '30 Days', 'Jazz / Zong Pakistan Hub', 'PRV-106', 7500.00, 4800.00, 2700.00, 'High Speed 4G, Heavy Streaming', 'Active', 'Double data allowance for extended stay.', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z'),
('PKG-103', 'UAE / Dubai', 'UAE 5GB Traveler', '5GB', '15 Days', 'du / Etisalat UAE Partner', 'PRV-105', 3800.00, 2400.00, 1400.00, '5G Ultra Speed, Dubai & Abu Dhabi', 'Active', 'Tourist favorite for short visits and business.', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z'),
('PKG-104', 'UAE / Dubai', 'UAE 10GB Business', '10GB', '30 Days', 'du / Etisalat UAE Partner', 'PRV-105', 6500.00, 4200.00, 2300.00, '5G Roaming, Hotspot Enabled', 'Active', '30 days validity for corporate and long stay.', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z'),
('PKG-105', 'Turkey', 'Turkey 10GB Holiday', '10GB', '30 Days', 'Turkcell Direct Wholesale', 'PRV-104', 4900.00, 3100.00, 1800.00, 'Turkcell 4.5G, Istanbul & Antalya', 'Active', 'Fastest connection in Turkey on Turkcell.', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z'),
('PKG-106', 'Turkey', 'Turkey 20GB Heavy', '20GB', '30 Days', 'Turkcell Direct Wholesale', 'PRV-104', 8500.00, 5400.00, 3100.00, 'Turkcell 4.5G, High Data Bundle', 'Active', 'Full vacation bundle for photos & video.', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z'),
('PKG-107', 'Saudi Arabia', 'KSA Umrah 10GB', '10GB', '30 Days', 'STC / Mobily Saudi Roam', 'PRV-107', 5500.00, 3500.00, 2000.00, '5G STC & Mobily, Makkah/Madinah', 'Active', 'Special Umrah pilgrim bundle.', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z'),
('PKG-108', 'Europe (33 Countries)', 'Europe 10GB Regional', '10GB', '30 Days', '1GLOBAL Roaming', 'PRV-102', 6200.00, 3900.00, 2300.00, 'EU Roaming, UK, France, Germany', 'Active', '33 European countries unified bundle.', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z'),
('PKG-109', 'Europe (33 Countries)', 'Europe 20GB Regional', '20GB', '30 Days', '1GLOBAL Roaming', 'PRV-102', 9800.00, 6400.00, 3400.00, 'Multi-country EU High Data', 'Active', 'High-data European tour package.', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z'),
('PKG-110', 'USA & Canada', 'North America 20GB Unlimited Talk', '20GB', '30 Days', 'Gigs Global Connect', 'PRV-108', 9200.00, 5800.00, 3400.00, 'T-Mobile & AT&T 5G Network', 'Active', 'United States & Canada combined roaming.', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z'),
('PKG-111', 'Global (130+ Countries)', 'Global 5GB Explorer', '5GB', '30 Days', 'eSIMGo Wholesale', 'PRV-101', 7800.00, 5000.00, 2800.00, '130+ Countries Single Profile', 'Active', 'Multi-continent explorer package.', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z'),
('PKG-112', 'East Asia (Japan/Korea/Thai)', 'East Asia 10GB Roam', '10GB', '15 Days', 'Redtea Mobile', 'PRV-103', 6800.00, 4400.00, 2400.00, 'SoftBank & Docomo 5G', 'Active', 'Travel across Japan, Korea, and Thailand.', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z');

INSERT OR REPLACE INTO settings (key, value, description, updated_at) VALUES
('company_name', 'Callbite Esim', 'Portal branding name', '2026-08-23T00:00:00Z'),
('currency_symbol', 'Rs.', 'Default display currency symbol (PKR)', '2026-08-23T00:00:00Z'),
('currency_code', 'PKR', 'Default currency code', '2026-08-23T00:00:00Z'),
('support_phone', '+923001234567', 'Official WhatsApp support contact', '2026-08-23T00:00:00Z');

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

INSERT OR REPLACE INTO package_presets (id, country_region, package_name, data_allowance, duration, provider, provider_id, default_selling_price, default_cost_price, is_active) VALUES
(1, 'Pakistan', 'Pakistan 10GB Standard', '10GB', '30 Days', 'Jazz / Zong Pakistan Hub', 'PRV-106', 4500.00, 2800.00, 1),
(2, 'Pakistan', 'Pakistan 20GB Max', '20GB', '30 Days', 'Jazz / Zong Pakistan Hub', 'PRV-106', 7500.00, 4800.00, 1),
(3, 'UAE / Dubai', 'UAE 5GB Traveler', '5GB', '15 Days', 'du / Etisalat UAE Partner', 'PRV-105', 3800.00, 2400.00, 1),
(4, 'UAE / Dubai', 'UAE 10GB Business', '10GB', '30 Days', 'du / Etisalat UAE Partner', 'PRV-105', 6500.00, 4200.00, 1),
(5, 'Turkey', 'Turkey 10GB Holiday', '10GB', '30 Days', 'Turkcell Direct Wholesale', 'PRV-104', 4900.00, 3100.00, 1),
(6, 'Turkey', 'Turkey 20GB Heavy', '20GB', '30 Days', 'Turkcell Direct Wholesale', 'PRV-104', 8500.00, 5400.00, 1),
(7, 'Saudi Arabia', 'KSA Umrah 10GB', '10GB', '30 Days', 'STC / Mobily Saudi Roam', 'PRV-107', 5500.00, 3500.00, 1),
(8, 'Europe (33 Countries)', 'Europe 10GB Regional', '10GB', '30 Days', '1GLOBAL Roaming', 'PRV-102', 6200.00, 3900.00, 1),
(9, 'Europe (33 Countries)', 'Europe 20GB Regional', '20GB', '30 Days', '1GLOBAL Roaming', 'PRV-102', 9800.00, 6400.00, 1),
(10, 'USA & Canada', 'North America 20GB Unlimited Talk', '20GB', '30 Days', 'Gigs Global Connect', 'PRV-108', 9200.00, 5800.00, 1),
(11, 'Global (130+ Countries)', 'Global 5GB Explorer', '5GB', '30 Days', 'eSIMGo Wholesale', 'PRV-101', 7800.00, 5000.00, 1);
