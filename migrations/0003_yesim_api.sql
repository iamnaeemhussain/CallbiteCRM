-- Yesim Partner API tables for Callbite Esim (same D1 database: callbite-crm)

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

CREATE INDEX IF NOT EXISTS idx_yesim_logs_created ON yesim_api_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_yesim_profiles_iccid ON yesim_profiles(iccid);

INSERT OR IGNORE INTO settings (key, value, description, updated_at) VALUES
('yesim_api_base_url', 'https://partners-api.yesim.biz', 'Yesim Partner API base URL', '2026-08-27T00:00:00Z'),
('yesim_eur_to_pkr', '310', 'EUR to PKR conversion rate for importing Yesim wholesale plans', '2026-08-27T00:00:00Z'),
('yesim_notification_url', '', 'Webhook URL registered with Yesim /set_notification_url', '2026-08-27T00:00:00Z');
