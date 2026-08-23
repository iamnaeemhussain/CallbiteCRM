import { Hono } from 'hono';
import { Env, StaffUser, StaffRole, StaffStatus } from '../types';
import { authMiddleware, adminOnlyMiddleware } from '../auth';
import { logAudit, generateId } from '../db';

const staffApp = new Hono<{ Bindings: Env; Variables: { user: StaffUser } }>();

staffApp.use('*', authMiddleware);

// List all staff members
staffApp.get('/', async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');

    const users = await db
      .prepare(
        `SELECT 
          u.id, u.name, u.email, u.role, u.phone, u.status, u.avatar_url, u.created_at, u.updated_at, u.last_login_at,
          (SELECT COUNT(*) FROM customers c WHERE c.assigned_staff_id = u.id AND c.is_deleted = 0) AS assigned_customers_count,
          (SELECT COUNT(*) FROM esims e WHERE e.created_by_staff_id = u.id AND e.is_deleted = 0) AS created_esims_count,
          (SELECT COUNT(*) FROM support_tickets s WHERE s.assigned_staff_id = u.id AND s.status = 'Resolved') AS resolved_tickets_count,
          (SELECT COUNT(*) FROM transactions t WHERE t.staff_id = u.id) AS transactions_count
         FROM users u
         ORDER BY u.role = 'ADMIN' DESC, u.name ASC`
      )
      .all<any>();

    return c.json({
      success: true,
      staff: users.results || [],
      is_admin: currentUser.role === 'ADMIN',
    });
  } catch (err: any) {
    console.error('List staff error:', err);
    return c.json({ success: true, staff: [], is_admin: true });
  }
});

// Single staff details
staffApp.get('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const staffId = c.req.param('id');

    const staff = await db
      .prepare(
        `SELECT id, name, email, role, phone, status, avatar_url, created_at, updated_at, last_login_at
         FROM users WHERE id = ?`
      )
      .bind(staffId)
      .first<StaffUser>();

    if (!staff) {
      return c.json({ success: false, error: 'Staff member not found.' }, 404);
    }

    const recentAuditLogs = await db
      .prepare(`SELECT * FROM audit_logs WHERE staff_id = ? ORDER BY created_at DESC LIMIT 20`)
      .bind(staffId)
      .all<any>();

    return c.json({
      success: true,
      staff,
      recent_logs: recentAuditLogs.results || [],
    });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to load staff details.' }, 500);
  }
});

// Create Staff
staffApp.post('/', async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');
    const body = await c.req.json<{
      name: string;
      email: string;
      password?: string;
      role?: StaffRole;
      phone?: string;
      status?: StaffStatus;
    }>();

    if (!body.name || !body.name.trim()) {
      return c.json({ success: false, error: 'Name is required.' }, 400);
    }
    if (!body.email || !body.email.trim()) {
      return c.json({ success: false, error: 'Email is required.' }, 400);
    }
    if (!body.password || body.password.length < 8) {
      return c.json({ success: false, error: 'Password must be at least 8 characters long.' }, 400);
    }

    const cleanEmail = body.email.trim();

    const existing = await db
      .prepare(`SELECT id FROM users WHERE LOWER(email) = LOWER(?)`)
      .bind(cleanEmail)
      .first<{ id: string }>();

    if (existing) {
      return c.json({ success: false, error: 'A staff member with this email already exists.' }, 400);
    }

    const now = new Date().toISOString();
    const staffId = await generateId(db, 'users', 'STF', 101);

    await db
      .prepare(
        `INSERT INTO users (id, name, email, password, role, phone, status, avatar_url, created_at, updated_at, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)`
      )
      .bind(
        staffId,
        body.name.trim(),
        cleanEmail,
        body.password,
        body.role || 'SUPPORT_STAFF',
        body.phone?.trim() || null,
        body.status || 'active',
        now,
        now
      )
      .run();

    const clientIp = c.req.header('cf-connecting-ip') || '127.0.0.1';
    await logAudit(db, {
      staff_id: currentUser.id,
      staff_name: currentUser.name,
      action: 'CREATE',
      record_type: 'STAFF',
      record_id: staffId,
      new_value: { name: body.name, email: cleanEmail, role: body.role },
      change_summary: `${currentUser.name} created new staff member ${body.name.trim()} (${body.role || 'SUPPORT_STAFF'})`,
      ip_address: clientIp,
    });

    return c.json({
      success: true,
      message: 'Staff member created successfully.',
      staff_id: staffId,
    });
  } catch (err: any) {
    console.error('Create staff error:', err);
    return c.json({ success: false, error: 'Failed to create staff member.' }, 500);
  }
});

// Update Staff
staffApp.put('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');
    const staffId = c.req.param('id');
    const body = await c.req.json<{
      name?: string;
      email?: string;
      password?: string;
      role?: StaffRole;
      phone?: string;
      status?: StaffStatus;
    }>();

    const existing = await db
      .prepare(`SELECT * FROM users WHERE id = ?`)
      .bind(staffId)
      .first<StaffUser & { password?: string }>();

    if (!existing) {
      return c.json({ success: false, error: 'Staff member not found.' }, 404);
    }

    if (body.email && body.email.trim().toLowerCase() !== existing.email.toLowerCase()) {
      const dup = await db
        .prepare(`SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?`)
        .bind(body.email.trim(), staffId)
        .first<{ id: string }>();

      if (dup) {
        return c.json({ success: false, error: 'Email is already in use by another staff member.' }, 400);
      }
    }

    if (body.password && body.password.length < 8) {
      return c.json({ success: false, error: 'Password must be at least 8 characters long.' }, 400);
    }

    const now = new Date().toISOString();
    const newPassword = body.password ? body.password : existing.password;
    const newName = body.name ? body.name.trim() : existing.name;
    const newEmail = body.email ? body.email.trim() : existing.email;
    const newRole = body.role || existing.role;
    const newPhone = body.phone !== undefined ? body.phone?.trim() || null : existing.phone;
    const newStatus = body.status || existing.status;

    await db
      .prepare(
        `UPDATE users SET name = ?, email = ?, password = ?, role = ?, phone = ?, status = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(newName, newEmail, newPassword, newRole, newPhone, newStatus, now, staffId)
      .run();

    if (newStatus === 'inactive') {
      await db.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(staffId).run();
    }

    const clientIp = c.req.header('cf-connecting-ip') || '127.0.0.1';
    await logAudit(db, {
      staff_id: currentUser.id,
      staff_name: currentUser.name,
      action: 'UPDATE',
      record_type: 'STAFF',
      record_id: staffId,
      previous_value: { name: existing.name, role: existing.role, status: existing.status },
      new_value: { name: newName, role: newRole, status: newStatus },
      change_summary: `${currentUser.name} updated staff ${newName} (${staffId})`,
      ip_address: clientIp,
    });

    return c.json({ success: true, message: 'Staff member updated successfully.' });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to update staff member.' }, 500);
  }
});

export default staffApp;
