export async function ensureReferralRequestTables(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS referral_requests (id TEXT PRIMARY KEY, friend_name TEXT NOT NULL, friend_whatsapp TEXT NOT NULL, friend_phone_model TEXT, notes TEXT, referrer_name TEXT, referrer_phone TEXT, referrer_email TEXT, source TEXT NOT NULL DEFAULT 'pak-tel.com', status TEXT NOT NULL DEFAULT 'New', converted_customer_id TEXT, ip_address TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`
    )
    .run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_referral_requests_created ON referral_requests(created_at)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_referral_requests_status ON referral_requests(status)`).run();
}
