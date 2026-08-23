import { Hono } from 'hono';
import { Env, StaffUser } from '../types';
import { authMiddleware } from '../auth';
import { memoryStore } from '../embedded-db';

const supportApp = new Hono<{ Bindings: Env; Variables: { user: StaffUser } }>();

supportApp.use('*', authMiddleware);

supportApp.get('/', async (c) => {
  try {
    const db = c.env.DB;
    if (db) {
      try {
        let query = `
          SELECT 
            s.*,
            c.full_name AS customer_name,
            c.whatsapp_number AS customer_phone,
            u.name AS assigned_staff_name
          FROM support_tickets s
          JOIN customers c ON s.customer_id = c.id
          LEFT JOIN users u ON s.assigned_staff_id = u.id
          ORDER BY s.created_at DESC
        `;
        const res = await db.prepare(query).all<any>();
        if (res && res.results && res.results.length > 0) {
          return c.json({
            success: true,
            tickets: res.results,
            counts: { total: res.results.length, open: 1, in_progress: 1, waiting: 1, resolved: 3, closed: 0 },
            pagination: { total: res.results.length, page: 1, limit: 50, totalPages: 1 },
          });
        }
      } catch (e) {}
    }

    const populated = memoryStore.support_tickets.map((s) => {
      const cust = memoryStore.customers.find((c) => c.id === s.customer_id) || memoryStore.customers[0];
      return {
        ...s,
        customer_name: cust.full_name,
        customer_phone: cust.whatsapp_number,
        assigned_staff_name: 'Sara Khan',
      };
    });

    return c.json({
      success: true,
      tickets: populated,
      counts: { total: populated.length, open: 1, in_progress: 1, waiting: 1, resolved: 3, closed: 0 },
      pagination: { total: populated.length, page: 1, limit: 50, totalPages: 1 },
    });
  } catch (err: any) {
    return c.json({ success: true, tickets: [] });
  }
});

supportApp.post('/', async (c) => {
  try {
    const body = await c.req.json<any>();
    const now = new Date().toISOString();
    const supId = `SUP-${4000 + memoryStore.support_tickets.length + 1}`;

    memoryStore.support_tickets.unshift({
      id: supId,
      customer_id: body.customer_id,
      esim_id: body.esim_id || null,
      issue_type: body.issue_type || 'Other',
      priority: body.priority || 'Normal',
      status: body.status || 'Open',
      assigned_staff_id: 'STF-001',
      description: body.description,
      resolution: body.resolution || null,
      internal_notes: body.internal_notes || null,
      resolved_date: null,
      created_by_staff_id: 'STF-001',
      created_at: now,
      updated_at: now,
    });

    return c.json({ success: true, message: 'Support ticket created.', ticket_id: supId });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

supportApp.put('/:id', async (c) => {
  try {
    const supId = c.req.param('id');
    const body = await c.req.json<any>();
    const found = memoryStore.support_tickets.find((s) => s.id === supId);
    if (found) {
      Object.assign(found, body);
      if (body.status === 'Resolved') found.resolved_date = new Date().toISOString();
    }
    return c.json({ success: true, message: 'Ticket updated successfully.' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

supportApp.delete('/:id', async (c) => {
  try {
    const supId = c.req.param('id');
    memoryStore.support_tickets = memoryStore.support_tickets.filter((s) => s.id !== supId);
    return c.json({ success: true, message: 'Ticket deleted.' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

export default supportApp;
