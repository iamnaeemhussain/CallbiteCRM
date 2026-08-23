import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';

function sanitizeParam(p: any): any {
  if (p === undefined) return null;
  if (typeof p === 'boolean') return p ? 1 : 0;
  return p;
}

export function createLocalD1(dbPath = 'local.db'): D1Database {
  const resolvedPath = path.resolve(process.cwd(), dbPath);
  const db = new DatabaseSync(resolvedPath);

  // Enable WAL mode for high concurrency
  try {
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
  } catch {}

  // Auto-init schema if table users doesn't exist
  try {
    const check = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    if (!check) {
      const schemaSql = fs.readFileSync(path.resolve(process.cwd(), 'migrations/0001_initial_schema.sql'), 'utf-8');
      const seedSql = fs.readFileSync(path.resolve(process.cwd(), 'migrations/0002_seed_data.sql'), 'utf-8');
      db.exec('PRAGMA foreign_keys = OFF;');
      db.exec(schemaSql);
      db.exec(seedSql);
      db.exec('PRAGMA foreign_keys = ON;');
    }
  } catch (e) {
    console.error('Error checking/initializing local DB:', e);
  }

  function createStatement(query: string, boundParams: any[] = []): D1PreparedStatement {
    const sanitized = boundParams.map(sanitizeParam);

    return {
      bind(...params: any[]) {
        return createStatement(query, params);
      },
      async first<T = unknown>(colName?: string): Promise<T | null> {
        const stmt = db.prepare(query);
        const row: any = stmt.get(...sanitized);
        if (!row) return null;
        if (colName) return (row[colName] ?? null) as T;
        return row as T;
      },
      async all<T = unknown>(): Promise<{ results: T[]; success: boolean; meta: any }> {
        const stmt = db.prepare(query);
        const results = stmt.all(...sanitized) as T[];
        return {
          results: results || [],
          success: true,
          meta: { changes: 0, last_row_id: 0, duration: 0 },
        };
      },
      async run(): Promise<{ success: boolean; meta: { changes: number; last_row_id: number } }> {
        const stmt = db.prepare(query);
        const info = stmt.run(...sanitized);
        return {
          success: true,
          meta: {
            changes: info.changes,
            last_row_id: Number(info.lastInsertRowid),
          },
        };
      },
      async raw<T = unknown>(): Promise<T[]> {
        const stmt = db.prepare(query);
        return stmt.all(...sanitized) as T[];
      },
    } as unknown as D1PreparedStatement;
  }

  return {
    prepare(query: string) {
      return createStatement(query);
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]) {
      const results: any[] = [];
      for (const stmt of statements) {
        const res = await (stmt as any).all();
        results.push(res);
      }
      return results;
    },
    async exec(query: string) {
      db.exec(query);
      return { count: 1, duration: 0 };
    },
    dump() {
      throw new Error('dump not implemented');
    },
  } as unknown as D1Database;
}
