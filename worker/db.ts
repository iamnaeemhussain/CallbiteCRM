import { StaffUser } from './types';

let isDbInitialized = false;

export async function ensureDbInitialized(db: D1Database) {
  if (isDbInitialized) return;
  try {
    // 1. Create all tables if not exist
    await db.exec(`
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
    `);

    // 2. Ensure Users Exist (Pre-seeded Admins)
    const userCount = await db.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>();
    if (!userCount || userCount.count === 0) {
      await db.exec(`
        INSERT OR REPLACE INTO users (id, name, email, password, role, phone, status, created_at, updated_at, last_login_at) VALUES
        ('STF-001', 'System Admin', 'Admin@callbite.com', 'Touch@11223', 'ADMIN', '+923000000001', 'active', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z', '2026-08-23T08:00:00Z'),
        ('STF-002', 'Naeem Hussain', 'Naeem@callbite.com', 'Touch@11223', 'ADMIN', '+923000000002', 'active', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z', '2026-08-23T08:00:00Z'),
        ('STF-003', 'Operations Admin', 'aaa@callbite.com', 'Touch@786', 'ADMIN', '+923000000003', 'active', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z', '2026-08-23T08:00:00Z'),
        ('STF-004', 'Sara Khan', 'sara.khan@callbite.com', 'Support@123', 'SUPPORT_STAFF', '+923011112233', 'active', '2026-02-15T00:00:00Z', '2026-08-23T00:00:00Z', '2026-08-23T07:10:00Z'),
        ('STF-005', 'Ali Raza', 'ali.raza@callbite.com', 'Support@123', 'SUPPORT_STAFF', '+923022223344', 'active', '2026-03-01T00:00:00Z', '2026-08-23T00:00:00Z', '2026-08-23T05:40:00Z');
      `);
    }

    // 3. Ensure Settings & Currency Exist
    const settingsCount = await db.prepare('SELECT COUNT(*) as count FROM settings').first<{ count: number }>();
    if (!settingsCount || settingsCount.count === 0) {
      await db.exec(`
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
      `);
    }

    // 4. Ensure Providers Exist
    const prvCount = await db.prepare('SELECT COUNT(*) as count FROM esim_providers').first<{ count: number }>();
    if (!prvCount || prvCount.count === 0) {
      await db.exec(`
        INSERT OR REPLACE INTO esim_providers (id, name, code, country_coverage, network_types, portal_url, support_email, support_phone, account_manager, status, integration_type, notes, created_at, updated_at) VALUES
        ('PRV-101', 'eSIMGo Wholesale', 'ESIMGO', 'Global (160+ Countries)', '5G / 4G LTE', 'https://esimgo.com/portal', 'wholesale@esimgo.com', '+442080998877', 'David Vance', 'Active', 'API Direct / Wholesale Portal', 'Primary global roaming supplier. SM-DP+ server: smdp.io', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z'),
        ('PRV-102', '1GLOBAL Roaming', '1GLOBAL', 'Europe, Americas & Asia', '5G / 4G LTE', 'https://1global.com/dashboard', 'support@1global.com', '+18005550199', 'Elena Rostova', 'Active', 'Manual Wholesale Portal', 'Tier-1 European network profiles with Orange/Vodafone roaming.', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z'),
        ('PRV-103', 'Redtea Mobile', 'REDTEA', 'Asia Pacific & Middle East', '5G / 4G LTE', 'https://redteamobile.com/partner', 'ops@redteamobile.com', '+85298765432', 'Kevin Chen', 'Active', 'Manual Portal & Batch CSV', 'High-data packages for Japan, China, UAE, and Southeast Asia.', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z'),
        ('PRV-104', 'Turkcell Direct Wholesale', 'TURKCELL', 'Turkey & Northern Cyprus', '4.5G LTE', 'https://turkcell.com.tr/kurumsal', 'esim@turkcell.com.tr', '+905327571000', 'Murat Demir', 'Active', 'Direct Carrier Partner', 'Direct local breakout in Istanbul with low latency and APN internet.', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z'),
        ('PRV-105', 'du / Etisalat UAE Partner', 'DU_ETISALAT', 'United Arab Emirates & GCC', '5G Ultra Wideband', 'https://du.ae/business/esim', 'partner@du.ae', '+97143905555', 'Rashid Al-Maktoum', 'Active', 'Direct Carrier Partner', 'Special traveler packages for Dubai & Abu Dhabi with 5G speed.', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z'),
        ('PRV-106', 'Jazz / Zong Pakistan Hub', 'JAZZ_PK', 'Pakistan Nationwide', '4G LTE Max', 'https://jazz.com.pk/business', 'b2b@jazz.com.pk', '+923000001111', 'Kamran Sheikh', 'Active', 'Direct Carrier Partner', 'Local partner for Pakistan inbound travelers & diaspora.', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z'),
        ('PRV-107', 'STC / Mobily Saudi Roam', 'STC_KSA', 'Saudi Arabia (Umrah/Hajj)', '5G Network', 'https://stc.com.sa/business', 'umrah-esim@stc.com.sa', '+966114555555', 'Abdullah Al-Ghamdi', 'Active', 'Direct Carrier Partner', 'Optimized for Makkah, Madinah, Riyadh, and Jeddah pilgrimage travel.', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z'),
        ('PRV-108', 'Gigs Global Connect', 'GIGS', 'North America & Europe', '5G / 4G LTE', 'https://gigs.com/console', 'support@gigs.com', '+14159988112', 'Sarah Miller', 'Active', 'API Direct / Reseller Console', 'High-reliability profiles for USA (T-Mobile/AT&T) & Canada.', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z');
      `);
    }

    // 5. Ensure Packages Exist (in PKR)
    const pkgCount = await db.prepare('SELECT COUNT(*) as count FROM packages').first<{ count: number }>();
    if (!pkgCount || pkgCount.count === 0) {
      await db.exec(`
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
      `);
    }

    // 6. Ensure Customers & eSIMs Exist
    const custCount = await db.prepare('SELECT COUNT(*) as count FROM customers').first<{ count: number }>();
    if (!custCount || custCount.count === 0) {
      await db.exec(`
        INSERT OR REPLACE INTO customers (id, full_name, whatsapp_number, phone_number, email, country, city, source, referred_by_customer_id, status, assigned_staff_id, internal_notes, is_deleted, created_at, updated_at, last_activity_at) VALUES
        ('CUST-1001', 'Ahmed Khan', '+923001234567', '+923001234567', 'ahmed.khan@gmail.com', 'Pakistan', 'Lahore', 'Instagram', NULL, 'VIP', 'STF-004', 'VIP customer, frequent traveler between UAE and Turkey. Always pays via Easypaisa.', 0, '2026-05-10T10:00:00Z', '2026-08-23T07:00:00Z', '2026-08-23T07:00:00Z'),
        ('CUST-1002', 'Fatima Zahra', '+971501234567', '+971501234567', 'fatima.zahra@outlook.com', 'United Arab Emirates', 'Dubai', 'TikTok', NULL, 'VIP', 'STF-004', 'Corporate coordinator for travel agency. Needs invoices sent to billing email.', 0, '2026-06-12T14:30:00Z', '2026-08-22T16:00:00Z', '2026-08-22T16:00:00Z'),
        ('CUST-1003', 'Bilal Tariq', '+923219876543', '+923219876543', 'bilal.tariq@yahoo.com', 'Pakistan', 'Karachi', 'Referred by', 'CUST-1001', 'Active', 'STF-005', 'Referred by Ahmed Khan. Needs renewal follow-up before expiry.', 0, '2026-07-01T09:15:00Z', '2026-08-21T11:00:00Z', '2026-08-21T11:00:00Z'),
        ('CUST-1004', 'Usman Ali', '+923334445566', '+923334445566', 'usman.ali@domain.com', 'Pakistan', 'Islamabad', 'Facebook', NULL, 'Active', 'STF-005', 'eSIM expires today, contacted on WhatsApp for renewal top-up.', 0, '2026-07-24T12:00:00Z', '2026-08-23T06:45:00Z', '2026-08-23T06:45:00Z'),
        ('CUST-1005', 'Sarah Jenkins', '+14155552671', '+14155552671', 's.jenkins@techcorp.io', 'United States', 'San Francisco', 'WhatsApp', NULL, 'Active', 'STF-004', 'US traveler who visited Pakistan and Europe.', 0, '2026-07-15T15:20:00Z', '2026-08-21T10:00:00Z', '2026-08-21T10:00:00Z'),
        ('CUST-1006', 'Muhammad Imran', '+966501112233', '+966501112233', 'imran.ksa@gmail.com', 'Saudi Arabia', 'Riyadh', 'Walk-in', NULL, 'Active', 'STF-004', 'Regular Umrah visitor and contractor. Prefers cash counter payments.', 0, '2026-08-01T08:00:00Z', '2026-08-20T14:00:00Z', '2026-08-20T14:00:00Z'),
        ('CUST-1007', 'Ayesha Noor', '+447911123456', '+447911123456', 'ayesha.noor@hotmail.co.uk', 'United Kingdom', 'London', 'Referred by', 'CUST-1002', 'Active', 'STF-005', 'Referred by Fatima Zahra.', 0, '2026-08-05T13:40:00Z', '2026-08-22T09:30:00Z', '2026-08-22T09:30:00Z'),
        ('CUST-1008', 'Hamza Sheikh', '+923456789012', '+923456789012', 'hamza.sheikh@gmail.com', 'Pakistan', 'Rawalpindi', 'Instagram', NULL, 'Active', 'STF-004', 'Travel photographer visiting Istanbul and Baku.', 0, '2026-08-10T11:00:00Z', '2026-08-23T04:20:00Z', '2026-08-23T04:20:00Z'),
        ('CUST-1009', 'Zainab Qureshi', '+923120003344', '+923120003344', 'zainab.q@gmail.com', 'Pakistan', 'Lahore', 'Instagram', 'CUST-1001', 'Active', 'STF-004', 'Referred by Ahmed Khan for Europe trip.', 0, '2026-08-12T10:00:00Z', '2026-08-23T06:00:00Z', '2026-08-23T06:00:00Z'),
        ('CUST-1010', 'Tariq Mehmood', '+971520008899', '+971520008899', 'tariq.mehmood@emirates.ae', 'United Arab Emirates', 'Abu Dhabi', 'TikTok', NULL, 'Active', 'STF-005', 'Airline crew member needing recurring monthly data.', 0, '2026-08-14T09:00:00Z', '2026-08-23T05:00:00Z', '2026-08-23T05:00:00Z'),
        ('CUST-1011', 'David Miller', '+12125550143', '+12125550143', 'david.m@globetrek.com', 'United States', 'New York', 'Website', NULL, 'VIP', 'STF-004', 'Global executive travelling across 5 countries every month.', 0, '2026-08-15T12:00:00Z', '2026-08-22T18:00:00Z', '2026-08-22T18:00:00Z'),
        ('CUST-1012', 'Mariam Siddiqui', '+923049988776', '+923049988776', 'mariam.siddiqui@gmail.com', 'Pakistan', 'Faisalabad', 'Facebook', NULL, 'Active', 'STF-005', 'Umrah traveler leaving on 26 Aug.', 0, '2026-08-16T14:00:00Z', '2026-08-23T03:00:00Z', '2026-08-23T03:00:00Z'),
        ('CUST-1013', 'Hassan Raza', '+966551239876', '+966551239876', 'hassan.raza@aramco.com', 'Saudi Arabia', 'Dammam', 'Referred by', 'CUST-1006', 'Active', 'STF-004', 'Referred by Muhammad Imran.', 0, '2026-08-18T16:00:00Z', '2026-08-22T12:00:00Z', '2026-08-22T12:00:00Z'),
        ('CUST-1014', 'Sophie Martin', '+33612345678', '+33612345678', 'sophie.martin@voyage.fr', 'France', 'Paris', 'Instagram', NULL, 'Active', 'STF-005', 'Digital nomad based in Bali & Thailand.', 0, '2026-08-19T11:00:00Z', '2026-08-23T02:00:00Z', '2026-08-23T02:00:00Z'),
        ('CUST-1015', 'Omer Farooq', '+923081122334', '+923081122334', 'omer.farooq@innovate.pk', 'Pakistan', 'Multan', 'Walk-in', NULL, 'Active', 'STF-004', 'Business traveler with Dubai & Turkey eSIMs.', 0, '2026-08-20T10:00:00Z', '2026-08-23T06:30:00Z', '2026-08-23T06:30:00Z');

        INSERT OR REPLACE INTO esims (id, customer_id, iccid, country_region, provider, provider_id, package_name, package_id, data_allowance, duration, start_date, expiry_date, renewal_date, activation_date, status, qr_code_data, apn_info, tag, notes, created_by_staff_id, is_deleted, created_at, updated_at) VALUES
        ('ESIM-2001', 'CUST-1001', '8901410321111851071F', 'Pakistan', 'Jazz / Zong Pakistan Hub', 'PRV-106', 'Pakistan 10GB Standard', 'PKG-101', '10GB', '30 Days', '2026-07-31', '2026-08-30', NULL, '2026-07-31', 'Active', 'LPA:1$smdp.io$CALLBITE-PK-10GB-8901410321111851071F', 'APN: internet', 'Primary SIM', 'Primary local SIM in Pakistan', 'STF-004', 0, '2026-07-31T10:00:00Z', '2026-07-31T10:00:00Z'),
        ('ESIM-2002', 'CUST-1001', '8901410321111851072F', 'UAE', 'du / Etisalat UAE Partner', 'PRV-105', 'UAE 5GB Traveler', 'PKG-103', '5GB', '15 Days', '2026-08-01', '2026-08-15', NULL, '2026-08-01', 'Expired', 'LPA:1$smdp.io$CALLBITE-UAE-5GB-8901410321111851072F', 'APN: globaldata', 'Traveler Line', 'Expired 15 Aug', 'STF-004', 0, '2026-08-01T12:00:00Z', '2026-08-15T23:59:59Z'),
        ('ESIM-2003', 'CUST-1001', '8901410321111851073F', 'Turkey', 'Turkcell Direct Wholesale', 'PRV-104', 'Turkey 20GB Heavy', 'PKG-106', '20GB', '30 Days', '2026-08-11', '2026-09-10', NULL, '2026-08-11', 'Active', 'LPA:1$smdp.io$CALLBITE-TR-20GB-8901410321111851073F', 'APN: epc.tmobile.com', 'Data Roaming', 'Active roaming in Istanbul', 'STF-004', 0, '2026-08-11T09:00:00Z', '2026-08-11T09:00:00Z'),
        ('ESIM-2004', 'CUST-1002', '8901410321111851074F', 'Europe (33 Countries)', '1GLOBAL Roaming', 'PRV-102', 'Europe 20GB Regional', 'PKG-109', '20GB', '30 Days', '2026-08-05', '2026-09-04', NULL, '2026-08-05', 'Active', 'LPA:1$smdp.io$CALLBITE-EU-20GB-8901410321111851074F', 'APN: orange.fr', 'Corporate Line', 'Traveling across France & Germany', 'STF-004', 0, '2026-08-05T14:00:00Z', '2026-08-05T14:00:00Z'),
        ('ESIM-2005', 'CUST-1003', '8901410321111851075F', 'UAE / Dubai', 'du / Etisalat UAE Partner', 'PRV-105', 'UAE 10GB Business', 'PKG-104', '10GB', '30 Days', '2026-07-26', '2026-08-25', NULL, '2026-07-26', 'Active', 'LPA:1$smdp.io$CALLBITE-UAE-10GB-8901410321111851075F', 'APN: du.ae', 'Primary SIM', 'Expires in 2 days (25 Aug)', 'STF-005', 0, '2026-07-26T10:00:00Z', '2026-07-26T10:00:00Z'),
        ('ESIM-2006', 'CUST-1004', '8901410321111851076F', 'Turkey', 'Turkcell Direct Wholesale', 'PRV-104', 'Turkey 10GB Holiday', 'PKG-105', '10GB', '30 Days', '2026-07-24', '2026-08-23', NULL, '2026-07-24', 'Active', 'LPA:1$smdp.io$CALLBITE-TR-10GB-8901410321111851076F', 'APN: internet', 'Traveler Line', 'Expires TODAY (23 Aug 2026)', 'STF-005', 0, '2026-07-24T12:00:00Z', '2026-07-24T12:00:00Z'),
        ('ESIM-2007', 'CUST-1005', '8901410321111851077F', 'USA & Canada', 'Gigs Global Connect', 'PRV-108', 'North America 20GB Unlimited Talk', 'PKG-110', '20GB', '30 Days', '2026-07-22', '2026-08-21', NULL, '2026-07-22', 'Expired', 'LPA:1$smdp.io$CALLBITE-US-20GB-8901410321111851077F', 'APN: fast.t-mobile.com', 'Backup Line', 'Expired 2 days ago', 'STF-004', 0, '2026-07-22T15:00:00Z', '2026-08-21T23:59:59Z'),
        ('ESIM-2008', 'CUST-1006', '8901410321111851078F', 'Saudi Arabia', 'STC / Mobily Saudi Roam', 'PRV-107', 'KSA Umrah 10GB', 'PKG-107', '10GB', '30 Days', '2026-08-01', '2026-08-31', NULL, '2026-08-01', 'Active', 'LPA:1$smdp.io$CALLBITE-KSA-10GB-8901410321111851078F', 'APN: jawalnet.com.sa', 'Umrah Special', 'Makkah & Madinah trip', 'STF-004', 0, '2026-08-01T08:30:00Z', '2026-08-01T08:30:00Z'),
        ('ESIM-2009', 'CUST-1007', '8901410321111851079F', 'Global (130+ Countries)', 'eSIMGo Wholesale', 'PRV-101', 'Global 5GB Explorer', 'PKG-111', '5GB', '30 Days', '2026-08-05', '2026-09-04', NULL, '2026-08-05', 'Active', 'LPA:1$smdp.io$CALLBITE-GL-5GB-8901410321111851079F', 'APN: globaldata', '5G Max Roam', 'Multi-city travel across Asia & EU', 'STF-005', 0, '2026-08-05T14:00:00Z', '2026-08-05T14:00:00Z'),
        ('ESIM-2010', 'CUST-1008', '8901410321111851080F', 'Turkey', 'Turkcell Direct Wholesale', 'PRV-104', 'Turkey 10GB Holiday', 'PKG-105', '10GB', '30 Days', '2026-08-10', '2026-09-09', NULL, '2026-08-10', 'Active', 'LPA:1$smdp.io$CALLBITE-TR-10GB-8901410321111851080F', 'APN: internet', 'Traveler Line', 'Pending activation check', 'STF-004', 0, '2026-08-10T11:30:00Z', '2026-08-10T11:30:00Z'),
        ('ESIM-2011', 'CUST-1009', '8901410321111851081F', 'Europe (33 Countries)', '1GLOBAL Roaming', 'PRV-102', 'Europe 10GB Regional', 'PKG-108', '10GB', '30 Days', '2026-08-12', '2026-09-11', NULL, '2026-08-12', 'Active', 'LPA:1$smdp.io$CALLBITE-EU-10GB-8901410321111851081F', 'APN: orange.fr', 'Data Roaming', 'Rome & Milan tour', 'STF-004', 0, '2026-08-12T10:30:00Z', '2026-08-12T10:30:00Z'),
        ('ESIM-2012', 'CUST-1010', '8901410321111851082F', 'UAE / Dubai', 'du / Etisalat UAE Partner', 'PRV-105', 'UAE 10GB Business', 'PKG-104', '10GB', '30 Days', '2026-08-14', '2026-09-13', NULL, '2026-08-14', 'Active', 'LPA:1$smdp.io$CALLBITE-UAE-10GB-8901410321111851082F', 'APN: du.ae', 'Corporate Line', 'Crew data line', 'STF-005', 0, '2026-08-14T09:30:00Z', '2026-08-14T09:30:00Z'),
        ('ESIM-2013', 'CUST-1011', '8901410321111851083F', 'Global (130+ Countries)', 'eSIMGo Wholesale', 'PRV-101', 'Global 5GB Explorer', 'PKG-111', '5GB', '30 Days', '2026-08-15', '2026-09-14', NULL, '2026-08-15', 'Active', 'LPA:1$smdp.io$CALLBITE-GL-5GB-8901410321111851083F', 'APN: globaldata', 'Primary SIM', 'Global executive profile', 'STF-004', 0, '2026-08-15T12:30:00Z', '2026-08-15T12:30:00Z'),
        ('ESIM-2014', 'CUST-1011', '8901410321111851084F', 'USA & Canada', 'Gigs Global Connect', 'PRV-108', 'North America 20GB Unlimited Talk', 'PKG-110', '20GB', '30 Days', '2026-08-15', '2026-09-14', NULL, '2026-08-15', 'Active', 'LPA:1$smdp.io$CALLBITE-US-20GB-8901410321111851084F', 'APN: fast.t-mobile.com', 'Secondary SIM', 'Secondary US line', 'STF-004', 0, '2026-08-15T12:35:00Z', '2026-08-15T12:35:00Z'),
        ('ESIM-2015', 'CUST-1012', '8901410321111851085F', 'Saudi Arabia', 'STC / Mobily Saudi Roam', 'PRV-107', 'KSA Umrah 10GB', 'PKG-107', '10GB', '30 Days', '2026-08-26', '2026-09-25', NULL, NULL, 'Pending', 'LPA:1$smdp.io$CALLBITE-KSA-10GB-8901410321111851085F', 'APN: jawalnet.com.sa', 'Umrah Special', 'Scheduled for 26 Aug Umrah departure', 'STF-005', 0, '2026-08-16T14:30:00Z', '2026-08-16T14:30:00Z'),
        ('ESIM-2016', 'CUST-1013', '8901410321111851086F', 'Saudi Arabia', 'STC / Mobily Saudi Roam', 'PRV-107', 'KSA Umrah 10GB', 'PKG-107', '10GB', '30 Days', '2026-08-18', '2026-09-17', NULL, '2026-08-18', 'Active', 'LPA:1$smdp.io$CALLBITE-KSA-10GB-8901410321111851086F', 'APN: jawalnet.com.sa', 'Umrah Special', 'Dammam resident roaming profile', 'STF-004', 0, '2026-08-18T16:30:00Z', '2026-08-18T16:30:00Z'),
        ('ESIM-2017', 'CUST-1014', '8901410321111851087F', 'East Asia', 'Redtea Mobile', 'PRV-103', 'East Asia 10GB Roam', 'PKG-112', '10GB', '15 Days', '2026-08-19', '2026-09-03', NULL, '2026-08-19', 'Active', 'LPA:1$smdp.io$CALLBITE-ASIA-10GB-8901410321111851087F', 'APN: 3gnet', 'Data Roaming', 'Bangkok & Tokyo trip', 'STF-005', 0, '2026-08-19T11:30:00Z', '2026-08-19T11:30:00Z'),
        ('ESIM-2018', 'CUST-1015', '8901410321111851088F', 'UAE / Dubai', 'du / Etisalat UAE Partner', 'PRV-105', 'UAE 5GB Traveler', 'PKG-103', '5GB', '15 Days', '2026-08-20', '2026-09-04', NULL, '2026-08-20', 'Active', 'LPA:1$smdp.io$CALLBITE-UAE-5GB-8901410321111851088F', 'APN: du.ae', 'Primary SIM', 'Dubai business trip', 'STF-004', 0, '2026-08-20T10:30:00Z', '2026-08-20T10:30:00Z');

        INSERT OR REPLACE INTO transactions (id, customer_id, esim_id, transaction_type, package_name, data_allowance, duration, date, selling_price, cost_price, profit, currency, payment_method, payment_status, staff_id, reference_id, notes, created_at, updated_at) VALUES
        ('TXN-3001', 'CUST-1001', 'ESIM-2001', 'New eSIM', 'Pakistan 10GB Standard', '10GB', '30 Days', '2026-07-31T10:05:00Z', 4500.00, 2800.00, 1700.00, 'PKR', 'Easypaisa', 'Paid', 'STF-004', 'EP-9988231', 'Initial purchase via Instagram', '2026-07-31T10:05:00Z', '2026-07-31T10:05:00Z'),
        ('TXN-3002', 'CUST-1001', 'ESIM-2002', 'New eSIM', 'UAE 5GB Traveler', '5GB', '15 Days', '2026-08-01T12:05:00Z', 3800.00, 2400.00, 1400.00, 'PKR', 'JazzCash', 'Paid', 'STF-004', 'JC-4411029', 'Dubai trip order', '2026-08-01T12:05:00Z', '2026-08-01T12:05:00Z'),
        ('TXN-3003', 'CUST-1001', 'ESIM-2003', 'New eSIM', 'Turkey 20GB Heavy', '20GB', '30 Days', '2026-08-11T09:10:00Z', 8500.00, 5400.00, 3100.00, 'PKR', 'Bank Transfer', 'Paid', 'STF-004', 'MEZN-772910', 'Istanbul vacation package', '2026-08-11T09:10:00Z', '2026-08-11T09:10:00Z'),
        ('TXN-3004', 'CUST-1002', 'ESIM-2004', 'New eSIM', 'Europe 20GB Regional', '20GB', '30 Days', '2026-08-05T14:10:00Z', 9800.00, 6400.00, 3400.00, 'PKR', 'Card', 'Paid', 'STF-004', 'STR-991204', 'Europe trip corporate card payment', '2026-08-05T14:10:00Z', '2026-08-05T14:10:00Z'),
        ('TXN-3005', 'CUST-1003', 'ESIM-2005', 'New eSIM', 'UAE 10GB Business', '10GB', '30 Days', '2026-07-26T10:10:00Z', 6500.00, 4200.00, 2300.00, 'PKR', 'Bank Transfer', 'Paid', 'STF-005', 'HBL-001928', 'Referred order', '2026-07-26T10:10:00Z', '2026-07-26T10:10:00Z'),
        ('TXN-3006', 'CUST-1004', 'ESIM-2006', 'New eSIM', 'Turkey 10GB Holiday', '10GB', '30 Days', '2026-07-24T12:05:00Z', 4900.00, 3100.00, 1800.00, 'PKR', 'Easypaisa', 'Paid', 'STF-005', 'EP-119284', 'Facebook ad response', '2026-07-24T12:05:00Z', '2026-07-24T12:05:00Z'),
        ('TXN-3007', 'CUST-1005', 'ESIM-2007', 'New eSIM', 'North America 20GB Unlimited Talk', '20GB', '30 Days', '2026-07-22T15:10:00Z', 9200.00, 5800.00, 3400.00, 'PKR', 'Card', 'Paid', 'STF-004', 'STR-882910', 'US visitor', '2026-07-22T15:10:00Z', '2026-07-22T15:10:00Z'),
        ('TXN-3008', 'CUST-1006', 'ESIM-2008', 'New eSIM', 'KSA Umrah 10GB', '10GB', '30 Days', '2026-08-01T08:35:00Z', 5500.00, 3500.00, 2000.00, 'PKR', 'Cash', 'Paid', 'STF-004', 'CSH-001', 'Walk-in cash counter', '2026-08-01T08:35:00Z', '2026-08-01T08:35:00Z'),
        ('TXN-3009', 'CUST-1007', 'ESIM-2009', 'New eSIM', 'Global 5GB Explorer', '5GB', '30 Days', '2026-08-05T14:15:00Z', 7800.00, 5000.00, 2800.00, 'PKR', 'Card', 'Paid', 'STF-005', 'STR-662810', 'Direct referral from Fatima Zahra', '2026-08-05T14:15:00Z', '2026-08-05T14:15:00Z'),
        ('TXN-3010', 'CUST-1008', 'ESIM-2010', 'New eSIM', 'Turkey 10GB Holiday', '10GB', '30 Days', '2026-08-10T11:35:00Z', 4900.00, 3100.00, 1800.00, 'PKR', 'JazzCash', 'Paid', 'STF-004', 'JC-992182', 'New customer order', '2026-08-10T11:35:00Z', '2026-08-10T11:35:00Z'),
        ('TXN-3011', 'CUST-1001', 'ESIM-2001', 'Renewal', 'Pakistan 10GB Standard', '10GB', '30 Days', '2026-08-23T07:00:00Z', 4500.00, 2800.00, 1700.00, 'PKR', 'Easypaisa', 'Paid', 'STF-004', 'EP-3344112', 'Monthly renewal recorded by Sara', '2026-08-23T07:00:00Z', '2026-08-23T07:00:00Z'),
        ('TXN-3012', 'CUST-1009', 'ESIM-2011', 'New eSIM', 'Europe 10GB Regional', '10GB', '30 Days', '2026-08-12T10:35:00Z', 6200.00, 3900.00, 2300.00, 'PKR', 'Easypaisa', 'Paid', 'STF-004', 'EP-449911', 'Referred order', '2026-08-12T10:35:00Z', '2026-08-12T10:35:00Z'),
        ('TXN-3013', 'CUST-1010', 'ESIM-2012', 'New eSIM', 'UAE 10GB Business', '10GB', '30 Days', '2026-08-14T09:35:00Z', 6500.00, 4200.00, 2300.00, 'PKR', 'Card', 'Paid', 'STF-005', 'STR-332211', 'Crew purchase', '2026-08-14T09:35:00Z', '2026-08-14T09:35:00Z'),
        ('TXN-3014', 'CUST-1011', 'ESIM-2013', 'New eSIM', 'Global 5GB Explorer', '5GB', '30 Days', '2026-08-15T12:35:00Z', 7800.00, 5000.00, 2800.00, 'PKR', 'Card', 'Paid', 'STF-004', 'STR-776655', 'Executive corporate plan', '2026-08-15T12:35:00Z', '2026-08-15T12:35:00Z'),
        ('TXN-3015', 'CUST-1011', 'ESIM-2014', 'New eSIM', 'North America 20GB Unlimited Talk', '20GB', '30 Days', '2026-08-15T12:40:00Z', 9200.00, 5800.00, 3400.00, 'PKR', 'Card', 'Paid', 'STF-004', 'STR-776656', 'US secondary line', '2026-08-15T12:40:00Z', '2026-08-15T12:40:00Z'),
        ('TXN-3016', 'CUST-1012', 'ESIM-2015', 'New eSIM', 'KSA Umrah 10GB', '10GB', '30 Days', '2026-08-16T14:35:00Z', 5500.00, 3500.00, 2000.00, 'PKR', 'Easypaisa', 'Paid', 'STF-005', 'EP-887711', 'Advance Umrah order', '2026-08-16T14:35:00Z', '2026-08-16T14:35:00Z'),
        ('TXN-3017', 'CUST-1013', 'ESIM-2016', 'New eSIM', 'KSA Umrah 10GB', '10GB', '30 Days', '2026-08-18T16:35:00Z', 5500.00, 3500.00, 2000.00, 'PKR', 'Cash', 'Paid', 'STF-004', 'CSH-002', 'Walk-in referral', '2026-08-18T16:35:00Z', '2026-08-18T16:35:00Z'),
        ('TXN-3018', 'CUST-1014', 'ESIM-2017', 'New eSIM', 'East Asia 10GB Roam', '10GB', '15 Days', '2026-08-19T11:35:00Z', 6800.00, 4400.00, 2400.00, 'PKR', 'Card', 'Paid', 'STF-005', 'STR-110022', 'Nomad order', '2026-08-19T11:35:00Z', '2026-08-19T11:35:00Z'),
        ('TXN-3019', 'CUST-1015', 'ESIM-2018', 'New eSIM', 'UAE 5GB Traveler', '5GB', '15 Days', '2026-08-20T10:35:00Z', 3800.00, 2400.00, 1400.00, 'PKR', 'JazzCash', 'Paid', 'STF-004', 'JC-334455', 'Dubai trip', '2026-08-20T10:35:00Z', '2026-08-20T10:35:00Z');
      `);
    }

    isDbInitialized = true;
  } catch (e) {
    console.error('ensureDbInitialized error:', e);
  }
}

export async function logTimeline(
  db: D1Database,
  params: {
    customer_id: string;
    staff_id?: string | null;
    action_type: string;
    title: string;
    description: string;
    metadata?: any;
  }
) {
  try {
    const now = new Date().toISOString();
    await db
      .prepare(
        `INSERT INTO activity_timeline (customer_id, staff_id, action_type, title, description, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        params.customer_id,
        params.staff_id || null,
        params.action_type,
        params.title,
        params.description,
        params.metadata ? JSON.stringify(params.metadata) : null,
        now
      )
      .run();

    await db
      .prepare(`UPDATE customers SET last_activity_at = ?, updated_at = ? WHERE id = ?`)
      .bind(now, now, params.customer_id)
      .run();
  } catch (err) {
    console.error('Failed to write to activity_timeline:', err);
  }
}

export async function logAudit(
  db: D1Database,
  params: {
    staff_id: string;
    staff_name: string;
    action: string;
    record_type: string;
    record_id: string;
    previous_value?: any;
    new_value?: any;
    change_summary?: string;
    ip_address?: string;
  }
) {
  try {
    const now = new Date().toISOString();
    await db
      .prepare(
        `INSERT INTO audit_logs (staff_id, staff_name, action, record_type, record_id, previous_value_json, new_value_json, change_summary, ip_address, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        params.staff_id,
        params.staff_name,
        params.action,
        params.record_type,
        params.record_id,
        params.previous_value ? JSON.stringify(params.previous_value) : null,
        params.new_value ? JSON.stringify(params.new_value) : null,
        params.change_summary || null,
        params.ip_address || null,
        now
      )
      .run();
  } catch (err) {
    console.error('Failed to write to audit_logs:', err);
  }
}

export async function generateId(db: D1Database, table: string, prefix: string, startNumber = 1001): Promise<string> {
  try {
    const result = await db
      .prepare(`SELECT id FROM ${table} WHERE id LIKE ? ORDER BY LENGTH(id) DESC, id DESC LIMIT 1`)
      .bind(`${prefix}-%`)
      .first<{ id: string }>();

    if (!result || !result.id) {
      return `${prefix}-${startNumber}`;
    }

    const match = result.id.match(new RegExp(`^${prefix}-(\\d+)`));
    if (match && match[1]) {
      const nextNum = parseInt(match[1], 10) + 1;
      return `${prefix}-${nextNum}`;
    }

    return `${prefix}-${Date.now().toString().slice(-4)}`;
  } catch (err) {
    return `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
  }
}
