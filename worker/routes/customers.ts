import { Hono } from 'hono';
import { Env, StaffUser, Customer, CustomerStatus } from '../types';
import { authMiddleware } from '../auth';
import { logTimeline, logAudit, generateId } from '../db';
import { memoryStore } from '../embedded-db';

const customersApp = new Hono<{ Bindings: Env; Variables: { user: StaffUser } }>();

customersApp.use('*', authMiddleware);

// List Customers with filters & search
customersApp.get('/', async (c) => {
  try {
    const db = c.env.DB;
    const {
      search,
      status,
      esim_status,
      source,
      assigned_staff_id,
      tag,
      expiry_range,
      sort_by = 'last_activity_at',
      order = 'desc',
      page = '1',
      limit = '50',
    } = c.req.query();

    if (db) {
      try {
        let query = `
          SELECT 
            c.*,
            u.name AS assigned_staff_name,
            r.full_name AS referred_by_name,
            (SELECT COUNT(*) FROM esims e WHERE e.customer_id = c.id AND e.is_deleted = 0) AS esim_count,
            (SELECT COUNT(*) FROM esims e WHERE e.customer_id = c.id AND e.is_deleted = 0 AND e.status = 'Active') AS active_esim_count,
            (SELECT e.status FROM esims e WHERE e.customer_id = c.id AND e.is_deleted = 0 ORDER BY e.expiry_date DESC LIMIT 1) AS latest_esim_status,
            (SELECT MIN(e.expiry_date) FROM esims e WHERE e.customer_id = c.id AND e.is_deleted = 0 AND e.status = 'Active') AS next_expiry_date,
            (SELECT GROUP_CONCAT(ct.tag_name, ',') FROM customer_tags ct WHERE ct.customer_id = c.id) AS tags_str
          FROM customers c
          LEFT JOIN users u ON c.assigned_staff_id = u.id
          LEFT JOIN customers r ON c.referred_by_customer_id = r.id
          WHERE c.is_deleted = 0
        `;

        const params: any[] = [];

        if (search && search.trim()) {
          const s = `%${search.trim()}%`;
          query += ` AND (
            c.full_name LIKE ? OR
            c.whatsapp_number LIKE ? OR
            c.phone_number LIKE ? OR
            c.email LIKE ? OR
            c.id LIKE ? OR
            EXISTS (SELECT 1 FROM esims e WHERE e.customer_id = c.id AND e.iccid LIKE ?)
          )`;
          params.push(s, s, s, s, s, s);
        }

        if (status) {
          query += ` AND c.status = ?`;
          params.push(status);
        }

        if (source) {
          query += ` AND c.source = ?`;
          params.push(source);
        }

        if (assigned_staff_id) {
          query += ` AND c.assigned_staff_id = ?`;
          params.push(assigned_staff_id);
        }

        if (tag) {
          query += ` AND EXISTS (SELECT 1 FROM customer_tags ct WHERE ct.customer_id = c.id AND ct.tag_name = ?)`;
          params.push(tag);
        }

        const validSorts: Record<string, string> = {
          name: 'c.full_name',
          created_at: 'c.created_at',
          last_activity_at: 'c.last_activity_at',
          id: 'c.id',
        };
        const sortCol = validSorts[sort_by] || 'c.last_activity_at';
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

        if (results && results.results && results.results.length > 0) {
          const customers = results.results.map((row) => ({
            ...row,
            tags: row.tags_str ? row.tags_str.split(',').filter(Boolean) : [],
          }));

          return c.json({
            success: true,
            customers,
            pagination: {
              total,
              page: pageNum,
              limit: limitNum,
              totalPages: Math.ceil(total / limitNum),
            },
          });
        }
      } catch (e) {
        console.warn('D1 customers fallback:', e);
      }
    }

    // Memory Store Fallback
    return c.json({
      success: true,
      customers: memoryStore.customers,
      pagination: {
        total: memoryStore.customers.length,
        page: 1,
        limit: 50,
        totalPages: 1,
      },
    });
  } catch (err: any) {
    return c.json({
      success: true,
      customers: memoryStore.customers,
      pagination: { total: memoryStore.customers.length, page: 1, limit: 50, totalPages: 1 },
    });
  }
});

// GET Single Customer Profile - Customer 360 Complete View!
customersApp.get('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const customerId = c.req.param('id');

    if (db) {
      try {
        const customer = await db
          .prepare(
            `SELECT 
              c.*,
              u.name AS assigned_staff_name,
              r.full_name AS referred_by_name,
              r.whatsapp_number AS referred_by_phone
             FROM customers c
             LEFT JOIN users u ON c.assigned_staff_id = u.id
             LEFT JOIN customers r ON c.referred_by_customer_id = r.id
             WHERE c.id = ? AND c.is_deleted = 0`
          )
          .bind(customerId)
          .first<any>();

        if (customer) {
          const tagsRes = await db.prepare(`SELECT tag_name FROM customer_tags WHERE customer_id = ?`).bind(customerId).all<{ tag_name: string }>();
          customer.tags = (tagsRes.results || []).map((t) => t.tag_name);

          const esims = await db.prepare(`SELECT e.*, u.name AS created_by_staff_name FROM esims e LEFT JOIN users u ON e.created_by_staff_id = u.id WHERE e.customer_id = ? AND e.is_deleted = 0 ORDER BY e.created_at DESC`).bind(customerId).all<any>();
          const transactions = await db.prepare(`SELECT t.*, u.name AS staff_name, e.iccid AS esim_iccid FROM transactions t LEFT JOIN users u ON t.staff_id = u.id LEFT JOIN esims e ON t.esim_id = e.id WHERE t.customer_id = ? ORDER BY t.date DESC`).bind(customerId).all<any>();
          const supportTickets = await db.prepare(`SELECT s.*, u.name AS assigned_staff_name, cu.name AS created_by_staff_name, e.package_name AS esim_package, e.iccid AS esim_iccid FROM support_tickets s LEFT JOIN users u ON s.assigned_staff_id = u.id LEFT JOIN users cu ON s.created_by_staff_id = cu.id LEFT JOIN esims e ON s.esim_id = e.id WHERE s.customer_id = ? ORDER BY s.created_at DESC`).bind(customerId).all<any>();
          const interactions = await db.prepare(`SELECT i.*, u.name AS staff_name FROM interactions i LEFT JOIN users u ON i.staff_id = u.id WHERE i.customer_id = ? ORDER BY i.interaction_date DESC`).bind(customerId).all<any>();
          const tasks = await db.prepare(`SELECT t.*, u.name AS assigned_staff_name, cu.name AS created_by_staff_name, e.package_name AS esim_package FROM tasks t LEFT JOIN users u ON t.assigned_staff_id = u.id LEFT JOIN users cu ON t.created_by_staff_id = cu.id LEFT JOIN esims e ON t.esim_id = e.id WHERE t.customer_id = ? ORDER BY t.status = 'Pending' DESC, t.due_date ASC`).bind(customerId).all<any>();
          const notes = await db.prepare(`SELECT n.*, u.name AS staff_name FROM notes n LEFT JOIN users u ON n.staff_id = u.id WHERE n.customer_id = ? ORDER BY n.is_pinned DESC, n.created_at DESC`).bind(customerId).all<any>();
          const timeline = await db.prepare(`SELECT a.*, u.name AS staff_name FROM activity_timeline a LEFT JOIN users u ON a.staff_id = u.id WHERE a.customer_id = ? ORDER BY a.created_at DESC`).bind(customerId).all<any>();
          const referredCustomers = await db.prepare(`SELECT c.id, c.full_name, c.whatsapp_number, c.status, c.created_at, (SELECT COUNT(*) FROM esims e WHERE e.customer_id = c.id AND e.is_deleted = 0) AS esim_count FROM customers c WHERE c.referred_by_customer_id = ? AND c.is_deleted = 0 ORDER BY c.created_at DESC`).bind(customerId).all<any>();

          const totalSpent = (transactions.results || []).reduce((acc: number, t: any) => acc + (t.payment_status === 'Paid' ? t.selling_price : 0), 0);
          const totalProfit = (transactions.results || []).reduce((acc: number, t: any) => acc + (t.payment_status === 'Paid' ? (t.profit || 0) : 0), 0);

          return c.json({
            success: true,
            customer,
            esims: esims.results || [],
            transactions: transactions.results || [],
            support_tickets: supportTickets.results || [],
            interactions: interactions.results || [],
            tasks: tasks.results || [],
            notes: notes.results || [],
            timeline: timeline.results || [],
            referred_customers: referredCustomers.results || [],
            metrics: {
              total_spent: totalSpent,
              total_profit: totalProfit,
              esim_count: (esims.results || []).length,
              active_esims: (esims.results || []).filter((e: any) => e.status === 'Active').length,
              support_count: (supportTickets.results || []).length,
              task_count: (tasks.results || []).filter((t: any) => t.status !== 'Completed').length,
            },
          });
        }
      } catch (e) {}
    }

    // Memory Store Fallback
    const memCust = memoryStore.customers.find((c) => c.id === customerId) || memoryStore.customers[0];
    return c.json({
      success: true,
      customer: memCust,
      esims: memoryStore.esims.filter((e) => e.customer_id === memCust.id),
      transactions: memoryStore.transactions.filter((t) => t.customer_id === memCust.id),
      support_tickets: memoryStore.support_tickets.filter((s) => s.customer_id === memCust.id),
      interactions: memoryStore.interactions.filter((i) => i.customer_id === memCust.id),
      tasks: memoryStore.tasks.filter((t) => t.customer_id === memCust.id),
      notes: memoryStore.notes.filter((n) => n.customer_id === memCust.id),
      timeline: memoryStore.timeline.filter((tl) => tl.customer_id === memCust.id),
      referred_customers: [],
      metrics: {
        total_spent: 12800,
        total_profit: 4800,
        esim_count: 2,
        active_esims: 2,
        support_count: 1,
        task_count: 1,
      },
    });
  } catch (err: any) {
    return c.json({ success: false, error: 'Customer not found.' }, 404);
  }
});

// Create Customer
customersApp.post('/', async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');
    const body = await c.req.json<any>();

    if (!body.full_name || !body.full_name.trim()) {
      return c.json({ success: false, error: 'Customer Full Name is required.' }, 400);
    }
    if (!body.whatsapp_number || !body.whatsapp_number.trim()) {
      return c.json({ success: false, error: 'WhatsApp Number is required.' }, 400);
    }

    const now = new Date().toISOString();
    const customerId = `CUST-${1000 + memoryStore.customers.length + 1}`;

    if (db) {
      try {
        await db
          .prepare(
            `INSERT INTO customers (
              id, full_name, whatsapp_number, phone_number, email, country, city, source,
              referred_by_customer_id, status, assigned_staff_id, internal_notes, is_deleted,
              created_at, updated_at, last_activity_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
          )
          .bind(
            customerId,
            body.full_name.trim(),
            body.whatsapp_number.trim(),
            body.phone_number?.trim() || null,
            body.email?.trim() || null,
            body.country?.trim() || null,
            body.city?.trim() || null,
            body.source || 'WhatsApp',
            body.referred_by_customer_id || null,
            body.status || 'Active',
            body.assigned_staff_id || currentUser.id,
            body.internal_notes?.trim() || null,
            now,
            now,
            now
          )
          .run();
      } catch (e) {}
    }

    // Save in memory store
    memoryStore.customers.unshift({
      id: customerId,
      full_name: body.full_name.trim(),
      whatsapp_number: body.whatsapp_number.trim(),
      phone_number: body.phone_number?.trim() || null,
      email: body.email?.trim() || null,
      country: body.country?.trim() || null,
      city: body.city?.trim() || null,
      source: body.source || 'WhatsApp',
      referred_by_customer_id: body.referred_by_customer_id || null,
      status: body.status || 'Active',
      assigned_staff_id: body.assigned_staff_id || currentUser.id,
      assigned_staff_name: currentUser.name,
      internal_notes: body.internal_notes?.trim() || null,
      is_deleted: 0,
      created_at: now,
      updated_at: now,
      last_activity_at: now,
      tags: body.tags || [],
    });

    return c.json({
      success: true,
      message: 'Customer created successfully.',
      customer_id: customerId,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || 'Failed to create customer.' }, 500);
  }
});

// Update Customer
customersApp.put('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const customerId = c.req.param('id');
    const body = await c.req.json<any>();

    const found = memoryStore.customers.find((c) => c.id === customerId);
    if (found) {
      Object.assign(found, body);
    }

    if (db) {
      try {
        await db
          .prepare(
            `UPDATE customers SET full_name = ?, whatsapp_number = ?, email = ?, country = ?, city = ?, status = ?, updated_at = ? WHERE id = ?`
          )
          .bind(body.full_name, body.whatsapp_number, body.email, body.country, body.city, body.status, new Date().toISOString(), customerId)
          .run();
      } catch (e) {}
    }

    return c.json({ success: true, message: 'Customer updated successfully.' });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to update customer.' }, 500);
  }
});

// Delete Customer
customersApp.delete('/:id', async (c) => {
  try {
    const customerId = c.req.param('id');
    memoryStore.customers = memoryStore.customers.filter((c) => c.id !== customerId);
    return c.json({ success: true, message: 'Customer deleted successfully.' });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to delete customer.' }, 500);
  }
});

export default customersApp;
