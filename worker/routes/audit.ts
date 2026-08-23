import { Hono } from 'hono';
import { Env, StaffUser } from '../types';
import { authMiddleware, adminOnlyMiddleware } from '../auth';

const auditApp = new Hono<{ Bindings: Env; Variables: { user: StaffUser } }>();

auditApp.use('*', authMiddleware, adminOnlyMiddleware);

// Get system audit logs
auditApp.get('/', async (c) => {
  try {
    const db = c.env.DB;
    const {
      staff_id,
      record_type,
      action,
      search,
      from_date,
      to_date,
      page = '1',
      limit = '50',
    } = c.req.query();

    let query = `SELECT * FROM audit_logs WHERE 1=1`;
    const params: any[] = [];

    if (staff_id) {
      query += ` AND staff_id = ?`;
      params.push(staff_id);
    }

    if (record_type) {
      query += ` AND record_type = ?`;
      params.push(record_type);
    }

    if (action) {
      query += ` AND action = ?`;
      params.push(action);
    }

    if (from_date) {
      query += ` AND created_at >= ?`;
      params.push(from_date);
    }

    if (to_date) {
      query += ` AND created_at <= ?`;
      params.push(to_date);
    }

    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      query += ` AND (
        staff_name LIKE ? OR
        record_id LIKE ? OR
        change_summary LIKE ? OR
        previous_value_json LIKE ? OR
        new_value_json LIKE ?
      )`;
      params.push(s, s, s, s, s);
    }

    query += ` ORDER BY created_at DESC`;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    const countQuery = `SELECT COUNT(*) AS total FROM (${query})`;
    const countResult = await db.prepare(countQuery).bind(...params).first<{ total: number }>();
    const total = countResult?.total || 0;

    query += ` LIMIT ? OFFSET ?`;
    params.push(limitNum, offset);

    const logs = await db.prepare(query).bind(...params).all<any>();

    return c.json({
      success: true,
      logs: logs.results || [],
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err: any) {
    console.error('Audit logs error:', err);
    return c.json({ success: false, error: 'Failed to fetch audit logs.' }, 500);
  }
});

export default auditApp;
