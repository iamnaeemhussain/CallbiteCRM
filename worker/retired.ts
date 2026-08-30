const RETIRED_TABLES = [
  'transactions',
  'support_tickets',
  'tasks',
  'audit_logs',
  'package_presets',
  'packages',
  'esim_providers',
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
    await db.prepare('PRAGMA foreign_keys = ON').run();
  } catch (err) {
    console.error('dropRetiredTables failed:', err);
  }
  dropped = true;
}
