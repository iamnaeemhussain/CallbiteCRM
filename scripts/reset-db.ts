import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';

const dbPath = path.resolve(process.cwd(), 'local.db');
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const db = new DatabaseSync(dbPath);

const schemaSql = fs.readFileSync(path.resolve(process.cwd(), 'migrations/0001_initial_schema.sql'), 'utf-8');
const seedSql = fs.readFileSync(path.resolve(process.cwd(), 'migrations/0002_seed_data.sql'), 'utf-8');

db.exec('PRAGMA foreign_keys = OFF;');
db.exec(schemaSql);
db.exec(seedSql);
db.exec('PRAGMA foreign_keys = ON;');

console.log('Database cleanly reset and re-seeded!');
console.log('Customers count:', db.prepare('SELECT count(*) as count FROM customers').get());
console.log('eSIMs count:', db.prepare('SELECT count(*) as count FROM esims').get());
console.log('Providers count:', db.prepare('SELECT count(*) as count FROM esim_providers').get());
console.log('Transactions count:', db.prepare('SELECT count(*) as count FROM transactions').get());
console.log('Support count:', db.prepare('SELECT count(*) as count FROM support_tickets').get());
console.log('Tasks count:', db.prepare('SELECT count(*) as count FROM tasks').get());
