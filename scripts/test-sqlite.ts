import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';

const dbPath = path.resolve(process.cwd(), 'local.db');
const db = new DatabaseSync(dbPath);

const schemaSql = fs.readFileSync(path.resolve(process.cwd(), 'migrations/0001_initial_schema.sql'), 'utf-8');
const seedSql = fs.readFileSync(path.resolve(process.cwd(), 'migrations/0002_seed_data.sql'), 'utf-8');

db.exec(schemaSql);
db.exec(seedSql);

console.log('Schema and seed executed successfully!');

const stmt = db.prepare('SELECT count(*) as count FROM users');
const res = stmt.get();
console.log('Users count:', res);

const custStmt = db.prepare('SELECT count(*) as count FROM customers');
console.log('Customers count:', custStmt.get());
