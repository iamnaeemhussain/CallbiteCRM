import { Hono } from 'hono';
import { Env, StaffUser, Interaction } from '../types';
import { authMiddleware } from '../auth';
import { logTimeline, logAudit, generateId } from '../db';

const interactionsApp = new Hono<{ Bindings: Env; Variables: { user: StaffUser } }>();

interactionsApp.use('*', authMiddleware);

// List interactions
interactionsApp.get('/', async (c) => {
  try {
    const db = c.env.DB;
    const { customer_id, contact_type, staff_id, limit = '50' } = c.req.query();

    let query = `
      SELECT 
        i.*,
        c.full_name AS customer_name,
        c.whatsapp_number AS customer_phone,
        u.name AS staff_name
      FROM interactions i
      JOIN customers c ON i.customer_id = c.id
      LEFT JOIN users u ON i.staff_id = u.id
      WHERE c.is_deleted = 0
    `;

    const params: any[] = [];

    if (customer_id) {
      query += ` AND i.customer_id = ?`;
      params.push(customer_id);
    }

    if (contact_type) {
      query += ` AND i.contact_type = ?`;
      params.push(contact_type);
    }

    if (staff_id) {
      query += ` AND i.staff_id = ?`;
      params.push(staff_id);
    }

    query += ` ORDER BY i.interaction_date DESC LIMIT ?`;
    params.push(Math.min(100, Math.max(1, parseInt(limit, 10) || 50)));

    const results = await db.prepare(query).bind(...params).all<any>();

    return c.json({
      success: true,
      interactions: results.results || [],
    });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to fetch interactions.' }, 500);
  }
});

// Record interaction
interactionsApp.post('/', async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');
    const body = await c.req.json<{
      customer_id: string;
      contact_type: string;
      purpose?: string;
      notes: string;
      outcome?: string;
      interaction_date?: string;
    }>();

    if (!body.customer_id || !body.notes || !body.notes.trim()) {
      return c.json({ success: false, error: 'Customer and notes are required.' }, 400);
    }

    const customer = await db
      .prepare(`SELECT id, full_name FROM customers WHERE id = ? AND is_deleted = 0`)
      .bind(body.customer_id)
      .first<{ id: string; full_name: string }>();

    if (!customer) {
      return c.json({ success: false, error: 'Customer not found.' }, 404);
    }

    const now = new Date().toISOString();
    const interactionId = await generateId(db, 'interactions', 'INT', 5001);
    const interactionDate = body.interaction_date || now;

    let validStaffId: string = currentUser.id;
    const u = await db.prepare(`SELECT id FROM users WHERE id = ?`).bind(currentUser.id).first<{ id: string }>();
    if (!u) {
      const firstUser = await db.prepare(`SELECT id FROM users LIMIT 1`).first<{ id: string }>();
      if (firstUser) validStaffId = firstUser.id;
    }

    await db
      .prepare(
        `INSERT INTO interactions (
          id, customer_id, staff_id, contact_type, purpose, notes,
          outcome, interaction_date, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        interactionId,
        body.customer_id,
        validStaffId,
        body.contact_type || 'WhatsApp',
        body.purpose?.trim() || null,
        body.notes.trim(),
        body.outcome?.trim() || null,
        interactionDate,
        now
      )
      .run();

    await logTimeline(db, {
      customer_id: body.customer_id,
      staff_id: currentUser.id,
      action_type: 'INTERACTION_LOGGED',
      title: `${body.contact_type || 'Contact'} Interaction: ${body.purpose || 'Customer Contact'}`,
      description: `${currentUser.name} contacted via ${body.contact_type || 'WhatsApp'}. Outcome: ${body.outcome || 'Logged'} - "${body.notes.slice(0, 120)}"`,
      metadata: { contact_type: body.contact_type, purpose: body.purpose, outcome: body.outcome },
    });

    const clientIp = c.req.header('cf-connecting-ip') || '127.0.0.1';
    await logAudit(db, {
      staff_id: currentUser.id,
      staff_name: currentUser.name,
      action: 'CREATE',
      record_type: 'INTERACTION',
      record_id: interactionId,
      change_summary: `Recorded ${body.contact_type} interaction with ${customer.full_name}`,
      ip_address: clientIp,
    });

    return c.json({
      success: true,
      message: 'Interaction recorded successfully.',
      interaction_id: interactionId,
    });
  } catch (err: any) {
    console.error('Create interaction error:', err);
    return c.json({ success: false, error: 'Failed to record interaction.' }, 500);
  }
});

export default interactionsApp;
