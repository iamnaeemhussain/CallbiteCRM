const RETIRED_TABLES = [
  'transactions',
  'support_tickets',
  'tasks',
  'audit_logs',
  'package_presets',
  'esim_providers',
  'customer_tags',
  'notes',
  'interactions',
  'activity_timeline',
  'customers',
];

let dropped = false;

export async function dropRetiredTables(db: D1Database) {
  if (dropped) return;
  try {
    await db.prepare('PRAGMA foreign_keys = OFF').run();
    for (const table of RETIRED_TABLES) {
      try {
        await db.prepare(`DROP TABLE IF EXISTS ${table}`).run();
      } catch (err) {
        console.error(`Failed to drop ${table}:`, err);
      }
    }
    try {
      await db
        .prepare(`UPDATE settings SET value = 'Pak-tel.com', updated_at = ? WHERE key = 'company_name' AND value LIKE '%Callbite%'`)
        .bind(new Date().toISOString())
        .run();
    } catch {
      // ignore
    }
    // Leave FKs off so eSIM rows still insert after customers is gone.
  } catch (err) {
    console.error('dropRetiredTables failed:', err);
  }
  dropped = true;
}
