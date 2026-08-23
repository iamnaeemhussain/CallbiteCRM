import { Hono } from 'hono';
import { Env, StaffUser, SupportTicket } from '../types';
import { authMiddleware } from '../auth';
import { logTimeline, logAudit, generateId } from '../db';

const supportApp = new Hono<{ Bindings: Env; Variables: { user: StaffUser } }>();

supportApp.use('*', authMiddleware);

// List support tickets
supportApp.get('/', async (c) => {
  try {
    const db = c.env.DB;
    const {
      search,
      status,
      priority,
      issue_type,
      assigned_staff_id,
      customer_id,
      sort_by = 'created_at',
      order = 'desc',
      page = '1',
      limit = '50',
    } = c.req.query();

    let query = `
      SELECT 
        s.*,
        c.full_name AS customer_name,
        c.whatsapp_number AS customer_phone,
        u.name AS assigned_staff_name,
        cu.name AS created_by_staff_name,
        e.package_name AS esim_package,
        e.iccid AS esim_iccid
      FROM support_tickets s
      JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.assigned_staff_id = u.id
      LEFT JOIN users cu ON s.created_by_staff_id = cu.id
      LEFT JOIN esims e ON s.esim_id = e.id
      WHERE c.is_deleted = 0
    `;

    const params: any[] = [];

    if (customer_id) {
      query += ` AND s.customer_id = ?`;
      params.push(customer_id);
    }

    if (status) {
      query += ` AND s.status = ?`;
      params.push(status);
    }

    if (priority) {
      query += ` AND s.priority = ?`;
      params.push(priority);
    }

    if (issue_type) {
      query += ` AND s.issue_type = ?`;
      params.push(issue_type);
    }

    if (assigned_staff_id) {
      query += ` AND s.assigned_staff_id = ?`;
      params.push(assigned_staff_id);
    }

    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      query += ` AND (
        s.id LIKE ? OR
        s.description LIKE ? OR
        s.resolution LIKE ? OR
        c.full_name LIKE ? OR
        c.whatsapp_number LIKE ? OR
        e.iccid LIKE ?
      )`;
      params.push(s, s, s, s, s, s);
    }

    const sortCol = sort_by === 'priority' ? `CASE s.priority WHEN 'Urgent' THEN 1 WHEN 'High' THEN 2 WHEN 'Normal' THEN 3 ELSE 4 END` : 's.created_at';
    const sortDir = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    query += ` ORDER BY ${sortCol} ${sortDir}`;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    const countQuery = `SELECT COUNT(*) AS total FROM (${query})`;
    const countResult = await db.prepare(countQuery).bind(...params).first<{ total: number }>();
    const total = countResult?.total || 0;

    query += ` LIMIT ? OFFSET ?`;
    params.push(limitNum, offset);

    const results = await db.prepare(query).bind(...params).all<any>();

    const statusCounts = await db
      .prepare(
        `SELECT 
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END) AS open,
          SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress,
          SUM(CASE WHEN status = 'Waiting for Customer' THEN 1 ELSE 0 END) AS waiting,
          SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) AS resolved,
          SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) AS closed
         FROM support_tickets`
      )
      .first<{
        total: number;
        open: number;
        in_progress: number;
        waiting: number;
        resolved: number;
        closed: number;
      }>();

    return c.json({
      success: true,
      tickets: results.results || [],
      counts: {
        total: statusCounts?.total || 0,
        open: statusCounts?.open || 0,
        in_progress: statusCounts?.in_progress || 0,
        waiting: statusCounts?.waiting || 0,
        resolved: statusCounts?.resolved || 0,
        closed: statusCounts?.closed || 0,
      },
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err: any) {
    console.error('List support error:', err);
    return c.json({
      success: true,
      tickets: [],
      counts: { total: 0, open: 0, in_progress: 0, waiting: 0, resolved: 0, closed: 0 },
      pagination: { total: 0, page: 1, limit: 50, totalPages: 1 },
    });
  }
});

// Single ticket
supportApp.get('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const ticketId = c.req.param('id');

    const ticket = await db
      .prepare(
        `SELECT 
          s.*,
          c.full_name AS customer_name,
          c.whatsapp_number AS customer_phone,
          c.email AS customer_email,
          u.name AS assigned_staff_name,
          cu.name AS created_by_staff_name,
          e.package_name AS esim_package,
          e.iccid AS esim_iccid
         FROM support_tickets s
         JOIN customers c ON s.customer_id = c.id
         LEFT JOIN users u ON s.assigned_staff_id = u.id
         LEFT JOIN users cu ON s.created_by_staff_id = cu.id
         LEFT JOIN esims e ON s.esim_id = e.id
         WHERE s.id = ?`
      )
      .bind(ticketId)
      .first<any>();

    if (!ticket) {
      return c.json({ success: false, error: 'Ticket not found.' }, 404);
    }

    return c.json({ success: true, ticket });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to fetch ticket.' }, 500);
  }
});

// Create support ticket
supportApp.post('/', async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');
    const body = await c.req.json<{
      customer_id: string;
      esim_id?: string;
      issue_type: string;
      priority?: string;
      status?: string;
      assigned_staff_id?: string;
      description: string;
      internal_notes?: string;
    }>();

    if (!body.customer_id || !body.description || !body.description.trim()) {
      return c.json({ success: false, error: 'Customer and description are required.' }, 400);
    }

    const customer = await db
      .prepare(`SELECT id, full_name FROM customers WHERE id = ? AND is_deleted = 0`)
      .bind(body.customer_id)
      .first<{ id: string; full_name: string }>();

    if (!customer) {
      return c.json({ success: false, error: 'Customer not found.' }, 404);
    }

    const now = new Date().toISOString();
    const ticketId = await generateId(db, 'support_tickets', 'SUP', 4001);

    let validEsimId: string | null = null;
    if (body.esim_id && typeof body.esim_id === 'string' && body.esim_id.trim()) {
      const e = await db.prepare(`SELECT id FROM esims WHERE id = ? AND is_deleted = 0`).bind(body.esim_id.trim()).first<{ id: string }>();
      if (e) validEsimId = e.id;
    }

    let validAssignedStaffId: string | null = null;
    const targetStaffId = body.assigned_staff_id || currentUser?.id;
    if (targetStaffId && typeof targetStaffId === 'string' && targetStaffId.trim()) {
      const u = await db.prepare(`SELECT id FROM users WHERE id = ?`).bind(targetStaffId.trim()).first<{ id: string }>();
      if (u) validAssignedStaffId = u.id;
    }

    let validCreatedByStaffId: string | null = null;
    if (currentUser?.id) {
      const u = await db.prepare(`SELECT id FROM users WHERE id = ?`).bind(currentUser.id).first<{ id: string }>();
      if (u) validCreatedByStaffId = u.id;
    }

    await db
      .prepare(
        `INSERT INTO support_tickets (
          id, customer_id, esim_id, issue_type, priority, status,
          assigned_staff_id, description, resolution, internal_notes,
          resolved_date, created_by_staff_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?, ?, ?)`
      )
      .bind(
        ticketId,
        body.customer_id,
        validEsimId,
        body.issue_type || 'Other',
        body.priority || 'Normal',
        body.status || 'Open',
        validAssignedStaffId,
        body.description.trim(),
        body.internal_notes?.trim() || null,
        validCreatedByStaffId,
        now,
        now
      )
      .run();

    await logTimeline(db, {
      customer_id: body.customer_id,
      staff_id: currentUser.id,
      action_type: 'SUPPORT_CREATED',
      title: `Support Ticket #${ticketId} Created (${body.issue_type || 'Issue'})`,
      description: `${currentUser.name} created [${body.priority || 'Normal'}] ticket: "${body.description.slice(0, 100)}${body.description.length > 100 ? '...' : ''}"`,
      metadata: { ticket_id: ticketId, issue_type: body.issue_type, priority: body.priority },
    });

    const clientIp = c.req.header('cf-connecting-ip') || '127.0.0.1';
    await logAudit(db, {
      staff_id: currentUser.id,
      staff_name: currentUser.name,
      action: 'CREATE',
      record_type: 'SUPPORT',
      record_id: ticketId,
      new_value: { customer_id: body.customer_id, issue_type: body.issue_type, priority: body.priority },
      change_summary: `Created support ticket ${ticketId} for ${customer.full_name}`,
      ip_address: clientIp,
    });

    return c.json({
      success: true,
      message: 'Support ticket created successfully.',
      ticket_id: ticketId,
    });
  } catch (err: any) {
    console.error('Create support ticket error:', err);
    return c.json({ success: false, error: 'Failed to create support ticket.' }, 500);
  }
});

// Update support ticket
supportApp.put('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');
    const ticketId = c.req.param('id');
    const body = await c.req.json<Partial<SupportTicket>>();

    const existing = await db
      .prepare(`SELECT * FROM support_tickets WHERE id = ?`)
      .bind(ticketId)
      .first<SupportTicket>();

    if (!existing) {
      return c.json({ success: false, error: 'Ticket not found.' }, 404);
    }

    const now = new Date().toISOString();
    let resolvedDate = existing.resolved_date;
    if (body.status === 'Resolved' && existing.status !== 'Resolved') {
      resolvedDate = now;
    } else if (body.status && body.status !== 'Resolved' && body.status !== 'Closed') {
      resolvedDate = null;
    }

    const changes: string[] = [];
    if (body.status && body.status !== existing.status) {
      changes.push(`Status: ${existing.status} → ${body.status}`);
    }
    if (body.priority && body.priority !== existing.priority) {
      changes.push(`Priority: ${existing.priority} → ${body.priority}`);
    }

    await db
      .prepare(
        `UPDATE support_tickets SET
          esim_id = ?,
          issue_type = ?,
          priority = ?,
          status = ?,
          assigned_staff_id = ?,
          description = ?,
          resolution = ?,
          internal_notes = ?,
          resolved_date = ?,
          updated_at = ?
         WHERE id = ?`
      )
      .bind(
        body.esim_id !== undefined ? body.esim_id : existing.esim_id,
        body.issue_type || existing.issue_type,
        body.priority || existing.priority,
        body.status || existing.status,
        body.assigned_staff_id !== undefined ? body.assigned_staff_id : existing.assigned_staff_id,
        body.description || existing.description,
        body.resolution !== undefined ? body.resolution : existing.resolution,
        body.internal_notes !== undefined ? body.internal_notes : existing.internal_notes,
        resolvedDate,
        now,
        ticketId
      )
      .run();

    if (body.status === 'Resolved' && existing.status !== 'Resolved') {
      await logTimeline(db, {
        customer_id: existing.customer_id,
        staff_id: currentUser.id,
        action_type: 'SUPPORT_RESOLVED',
        title: `Support Ticket #${ticketId} Resolved`,
        description: `${currentUser.name} resolved ticket. Resolution: ${body.resolution || 'Resolved'}`,
        metadata: { ticket_id: ticketId, resolution: body.resolution },
      });
    } else if (changes.length > 0) {
      await logTimeline(db, {
        customer_id: existing.customer_id,
        staff_id: currentUser.id,
        action_type: 'SUPPORT_UPDATED',
        title: `Support Ticket #${ticketId} Updated`,
        description: `${currentUser.name} updated ticket: ${changes.join(', ')}`,
        metadata: { ticket_id: ticketId, changes },
      });
    }

    const clientIp = c.req.header('cf-connecting-ip') || '127.0.0.1';
    await logAudit(db, {
      staff_id: currentUser.id,
      staff_name: currentUser.name,
      action: 'UPDATE',
      record_type: 'SUPPORT',
      record_id: ticketId,
      previous_value: existing,
      new_value: body,
      change_summary: `${currentUser.name} updated ticket ${ticketId} (${changes.join(', ') || 'details updated'})`,
      ip_address: clientIp,
    });

    return c.json({ success: true, message: 'Ticket updated successfully.' });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to update ticket.' }, 500);
  }
});

// Delete ticket
supportApp.delete('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');
    const ticketId = c.req.param('id');

    const existing = await db
      .prepare(`SELECT * FROM support_tickets WHERE id = ?`)
      .bind(ticketId)
      .first<SupportTicket>();

    if (!existing) {
      return c.json({ success: false, error: 'Ticket not found.' }, 404);
    }

    await db.prepare(`DELETE FROM support_tickets WHERE id = ?`).bind(ticketId).run();

    const clientIp = c.req.header('cf-connecting-ip') || '127.0.0.1';
    await logAudit(db, {
      staff_id: currentUser.id,
      staff_name: currentUser.name,
      action: 'DELETE',
      record_type: 'SUPPORT',
      record_id: ticketId,
      previous_value: existing,
      change_summary: `${currentUser.name} deleted support ticket ${ticketId}`,
      ip_address: clientIp,
    });

    return c.json({ success: true, message: 'Ticket deleted successfully.' });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to delete ticket.' }, 500);
  }
});

export default supportApp;
