import { StaffUser } from './types';

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
    // Find highest existing ID starting with prefix
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
