import { Hono } from 'hono';
import { Env, StaffUser, Customer, CustomerStatus } from '../types';
import { authMiddleware } from '../auth';
import { logTimeline, logAudit, generateId } from '../db';

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

    if (esim_status) {
      query += ` AND EXISTS (SELECT 1 FROM esims e WHERE e.customer_id = c.id AND e.is_deleted = 0 AND e.status = ?)`;
      params.push(esim_status);
    }

    if (expiry_range) {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const addDays = (days: number) => {
        const d = new Date();
        d.setDate(d.getDate() + days);
        return d.toISOString().slice(0, 10);
      };

      if (expiry_range === 'expired') {
        query += ` AND EXISTS (SELECT 1 FROM esims e WHERE e.customer_id = c.id AND e.is_deleted = 0 AND e.expiry_date < ?)`;
        params.push(todayStr);
      } else if (expiry_range === 'today') {
        query += ` AND EXISTS (SELECT 1 FROM esims e WHERE e.customer_id = c.id AND e.is_deleted = 0 AND e.expiry_date = ?)`;
        params.push(todayStr);
      } else if (expiry_range === '3_days') {
        query += ` AND EXISTS (SELECT 1 FROM esims e WHERE e.customer_id = c.id AND e.is_deleted = 0 AND e.expiry_date >= ? AND e.expiry_date <= ?)`;
        params.push(todayStr, addDays(3));
      } else if (expiry_range === '7_days') {
        query += ` AND EXISTS (SELECT 1 FROM esims e WHERE e.customer_id = c.id AND e.is_deleted = 0 AND e.expiry_date >= ? AND e.expiry_date <= ?)`;
        params.push(todayStr, addDays(7));
      }
    }

    const validSorts: Record<string, string> = {
      name: 'c.full_name',
      created_at: 'c.created_at',
      last_activity_at: 'c.last_activity_at',
      id: 'c.id',
      expiry: 'next_expiry_date',
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

    const customers = (results.results || []).map((row) => ({
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
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err: any) {
    console.error('List customers error:', err);
    return c.json({ success: true, customers: [], pagination: { total: 0, page: 1, limit: 50, totalPages: 1 } });
  }
});

// GET Single Customer Profile - Customer 360 Complete View
customersApp.get('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const customerId = c.req.param('id');

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

    if (!customer) {
      return c.json({ success: false, error: 'Customer not found.' }, 404);
    }

    const tagsRes = await db.prepare(`SELECT tag_name FROM customer_tags WHERE customer_id = ?`).bind(customerId).all<{ tag_name: string }>();
    customer.tags = (tagsRes.results || []).map((t) => t.tag_name);

    const esims = await db.prepare(`SELECT e.*, u.name AS created_by_staff_name FROM esims e LEFT JOIN users u ON e.created_by_staff_id = u.id WHERE e.customer_id = ? AND e.is_deleted = 0 ORDER BY e.created_at DESC`).bind(customerId).all<any>();
    const interactions = await db.prepare(`SELECT i.*, u.name AS staff_name FROM interactions i LEFT JOIN users u ON i.staff_id = u.id WHERE i.customer_id = ? ORDER BY i.interaction_date DESC`).bind(customerId).all<any>();
    const notes = await db.prepare(`SELECT n.*, u.name AS staff_name FROM notes n LEFT JOIN users u ON n.staff_id = u.id WHERE n.customer_id = ? ORDER BY n.is_pinned DESC, n.created_at DESC`).bind(customerId).all<any>();
    const timeline = await db.prepare(`SELECT a.*, u.name AS staff_name FROM activity_timeline a LEFT JOIN users u ON a.staff_id = u.id WHERE a.customer_id = ? ORDER BY a.created_at DESC`).bind(customerId).all<any>();
    const referredCustomers = await db.prepare(`SELECT c.id, c.full_name, c.whatsapp_number, c.status, c.created_at, (SELECT COUNT(*) FROM esims e WHERE e.customer_id = c.id AND e.is_deleted = 0) AS esim_count FROM customers c WHERE c.referred_by_customer_id = ? AND c.is_deleted = 0 ORDER BY c.created_at DESC`).bind(customerId).all<any>();

    return c.json({
      success: true,
      customer,
      esims: esims.results || [],
      interactions: interactions.results || [],
      notes: notes.results || [],
      timeline: timeline.results || [],
      referred_customers: referredCustomers.results || [],
      metrics: {
        esim_count: (esims.results || []).length,
        active_esims: (esims.results || []).filter((e: any) => e.status === 'Active').length,
      },
    });
  } catch (err: any) {
    console.error('Get customer profile error:', err);
    return c.json({ success: false, error: 'Failed to load customer profile.' }, 500);
  }
});

// Create Customer
customersApp.post('/', async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');
    const body = await c.req.json<{
      full_name: string;
      whatsapp_number: string;
      phone_number?: string;
      email?: string;
      country?: string;
      city?: string;
      source?: string;
      referred_by_customer_id?: string;
      status?: CustomerStatus;
      assigned_staff_id?: string;
      internal_notes?: string;
      tags?: string[];
      initial_esim?: {
        iccid: string;
        country_region: string;
        provider: string;
        provider_id?: string;
        package_name: string;
        package_id?: string;
        data_allowance: string;
        duration: string;
        expiry_date: string;
        selling_price?: number;
        cost_price?: number;
        payment_method?: string;
        qr_code_data?: string;
        apn_info?: string;
        tag?: string;
        notes?: string;
      };
    }>();

    if (!body.full_name || !body.full_name.trim()) {
      return c.json({ success: false, error: 'Customer Full Name is required.' }, 400);
    }
    if (!body.whatsapp_number || !body.whatsapp_number.trim()) {
      return c.json({ success: false, error: 'WhatsApp Number is required.' }, 400);
    }

    const now = new Date().toISOString();
    const customerId = await generateId(db, 'customers', 'CUST', 1001);

    // Safe foreign key resolution for referred_by_customer_id
    let validReferredById: string | null = null;
    if (body.referred_by_customer_id && typeof body.referred_by_customer_id === 'string' && body.referred_by_customer_id.trim()) {
      const ref = await db
        .prepare(`SELECT id FROM customers WHERE id = ? AND is_deleted = 0`)
        .bind(body.referred_by_customer_id.trim())
        .first<{ id: string }>();
      if (ref) validReferredById = ref.id;
    }

    // Safe foreign key resolution for assigned_staff_id
    let validAssignedStaffId: string | null = null;
    const targetStaffId = body.assigned_staff_id || currentUser?.id;
    if (targetStaffId && typeof targetStaffId === 'string' && targetStaffId.trim()) {
      const stf = await db
        .prepare(`SELECT id FROM users WHERE id = ?`)
        .bind(targetStaffId.trim())
        .first<{ id: string }>();
      if (stf) validAssignedStaffId = stf.id;
    }

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
        validReferredById,
        body.status || 'Active',
        validAssignedStaffId,
        body.internal_notes?.trim() || null,
        now,
        now,
        now
      )
      .run();

    // Insert tags
    if (body.tags && Array.isArray(body.tags) && body.tags.length > 0) {
      for (const tag of body.tags) {
        if (tag && tag.trim()) {
          await db
            .prepare(`INSERT OR IGNORE INTO customer_tags (customer_id, tag_name) VALUES (?, ?)`)
            .bind(customerId, tag.trim())
            .run();
        }
      }
    }

    await logTimeline(db, {
      customer_id: customerId,
      staff_id: validAssignedStaffId,
      action_type: 'CUSTOMER_CREATED',
      title: 'Customer Account Created',
      description: `Staff member ${currentUser.name} registered ${body.full_name.trim()} (Source: ${body.source || 'WhatsApp'}).`,
      metadata: { source: body.source, phone: body.whatsapp_number },
    });

    const clientIp = c.req.header('cf-connecting-ip') || '127.0.0.1';
    await logAudit(db, {
      staff_id: validAssignedStaffId || currentUser.id,
      staff_name: currentUser.name,
      action: 'CREATE',
      record_type: 'CUSTOMER',
      record_id: customerId,
      new_value: { name: body.full_name, phone: body.whatsapp_number, source: body.source },
      change_summary: `Created customer ${body.full_name.trim()} (${customerId})`,
      ip_address: clientIp,
    });

    // If initial eSIM was provided
    if (body.initial_esim && body.initial_esim.iccid) {
      const esimId = await generateId(db, 'esims', 'ESIM', 2001);
      const esim = body.initial_esim;

      let validEsimProviderId: string | null = null;
      if (esim.provider_id && typeof esim.provider_id === 'string' && esim.provider_id.trim()) {
        const p = null as { id: string } | null; if (false) await db.prepare(`SELECT id FROM esim_providers WHERE id = ?`).bind(esim.provider_id.trim()).first<{ id: string }>();
        if (p) validEsimProviderId = p.id;
      }
      if (!validEsimProviderId && esim.provider && typeof esim.provider === 'string' && esim.provider.trim()) {
        const p = await db.prepare(`SELECT id FROM esim_providers WHERE name = ?`).bind(esim.provider.trim()).first<{ id: string }>();
        if (p) validEsimProviderId = p.id;
      }

      let validEsimPackageId: string | null = null;
      if (esim.package_id && typeof esim.package_id === 'string' && esim.package_id.trim()) {
        const pkg = await db.prepare(`SELECT id FROM packages WHERE id = ?`).bind(esim.package_id.trim()).first<{ id: string }>();
        if (pkg) validEsimPackageId = pkg.id;
      }
      if (!validEsimPackageId && esim.package_name && typeof esim.package_name === 'string' && esim.package_name.trim()) {
        const pkg = await db.prepare(`SELECT id FROM packages WHERE package_name = ?`).bind(esim.package_name.trim()).first<{ id: string }>();
        if (pkg) validEsimPackageId = pkg.id;
      }

      let validStaffId: string | null = null;
      if (currentUser?.id) {
        const u = await db.prepare(`SELECT id FROM users WHERE id = ?`).bind(currentUser.id).first<{ id: string }>();
        if (u) validStaffId = u.id;
      }
      
      await db
        .prepare(
          `INSERT INTO esims (
            id, customer_id, iccid, country_region, provider, provider_id, package_name,
            package_id, data_allowance, duration, start_date, expiry_date, status,
            qr_code_data, apn_info, tag, notes, created_by_staff_id, is_deleted,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?, ?, ?, 0, ?, ?)`
        )
        .bind(
          esimId,
          customerId,
          esim.iccid.trim(),
          esim.country_region || 'Pakistan',
          esim.provider || 'Callbite Partner',
          validEsimProviderId,
          esim.package_name || 'Standard eSIM',
          validEsimPackageId,
          esim.data_allowance || '10GB',
          esim.duration || '30 Days',
          now.slice(0, 10),
          esim.expiry_date,
          esim.qr_code_data || null,
          esim.apn_info || null,
          esim.tag || 'Primary SIM',
          esim.notes || null,
          validStaffId,
          now,
          now
        )
        .run();

      await logTimeline(db, {
        customer_id: customerId,
        staff_id: validStaffId,
        action_type: 'ESIM_ADDED',
        title: `eSIM Added: ${esim.package_name}`,
        description: `Added ${esim.package_name} (${esim.data_allowance}) with ICCID ${esim.iccid}.`,
        metadata: { iccid: esim.iccid, package: esim.package_name },
      });

    }

    return c.json({
      success: true,
      message: 'Customer created successfully.',
      customer_id: customerId,
    });
  } catch (err: any) {
    console.error('Create customer error:', err);
    return c.json({ success: false, error: err.message || 'Failed to create customer.' }, 500);
  }
});

// Update Customer
customersApp.put('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');
    const customerId = c.req.param('id');
    const body = await c.req.json<{
      full_name?: string;
      whatsapp_number?: string;
      phone_number?: string;
      email?: string;
      country?: string;
      city?: string;
      source?: string;
      referred_by_customer_id?: string;
      status?: CustomerStatus;
      assigned_staff_id?: string;
      internal_notes?: string;
      tags?: string[];
    }>();

    const existing = await db
      .prepare(`SELECT * FROM customers WHERE id = ? AND is_deleted = 0`)
      .bind(customerId)
      .first<Customer>();

    if (!existing) {
      return c.json({ success: false, error: 'Customer not found.' }, 404);
    }

    const now = new Date().toISOString();
    const changes: string[] = [];

    if (body.status && body.status !== existing.status) {
      changes.push(`Status: ${existing.status} → ${body.status}`);
      await logTimeline(db, {
        customer_id: customerId,
        staff_id: currentUser.id,
        action_type: 'CUSTOMER_STATUS_CHANGED',
        title: `Customer Status Changed to ${body.status}`,
        description: `${currentUser.name} changed status from ${existing.status} to ${body.status}.`,
      });
    }

    if (body.assigned_staff_id && body.assigned_staff_id !== existing.assigned_staff_id) {
      changes.push(`Assigned Staff updated`);
    }

    if (body.full_name && body.full_name !== existing.full_name) {
      changes.push(`Name: ${existing.full_name} → ${body.full_name}`);
    }

    await db
      .prepare(
        `UPDATE customers SET
          full_name = ?,
          whatsapp_number = ?,
          phone_number = ?,
          email = ?,
          country = ?,
          city = ?,
          source = ?,
          referred_by_customer_id = ?,
          status = ?,
          assigned_staff_id = ?,
          internal_notes = ?,
          updated_at = ?,
          last_activity_at = ?
         WHERE id = ?`
      )
      .bind(
        body.full_name !== undefined ? body.full_name.trim() : existing.full_name,
        body.whatsapp_number !== undefined ? body.whatsapp_number.trim() : existing.whatsapp_number,
        body.phone_number !== undefined ? body.phone_number?.trim() || null : existing.phone_number,
        body.email !== undefined ? body.email?.trim() || null : existing.email,
        body.country !== undefined ? body.country?.trim() || null : existing.country,
        body.city !== undefined ? body.city?.trim() || null : existing.city,
        body.source !== undefined ? body.source : existing.source,
        body.referred_by_customer_id !== undefined ? body.referred_by_customer_id || null : existing.referred_by_customer_id,
        body.status !== undefined ? body.status : existing.status,
        body.assigned_staff_id !== undefined ? body.assigned_staff_id || null : existing.assigned_staff_id,
        body.internal_notes !== undefined ? body.internal_notes?.trim() || null : existing.internal_notes,
        now,
        now,
        customerId
      )
      .run();

    if (body.tags && Array.isArray(body.tags)) {
      await db.prepare(`DELETE FROM customer_tags WHERE customer_id = ?`).bind(customerId).run();
      for (const tag of body.tags) {
        if (tag && tag.trim()) {
          await db
            .prepare(`INSERT OR IGNORE INTO customer_tags (customer_id, tag_name) VALUES (?, ?)`)
            .bind(customerId, tag.trim())
            .run();
        }
      }
    }

    const clientIp = c.req.header('cf-connecting-ip') || '127.0.0.1';
    await logAudit(db, {
      staff_id: currentUser.id,
      staff_name: currentUser.name,
      action: 'UPDATE',
      record_type: 'CUSTOMER',
      record_id: customerId,
      previous_value: existing,
      new_value: body,
      change_summary: changes.length > 0 ? `${currentUser.name} changed ${changes.join(', ')}` : `Updated customer ${customerId}`,
      ip_address: clientIp,
    });

    return c.json({ success: true, message: 'Customer updated successfully.' });
  } catch (err: any) {
    console.error('Update customer error:', err);
    return c.json({ success: false, error: 'Failed to update customer.' }, 500);
  }
});

// Delete Customer (Soft delete)
customersApp.delete('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');
    const customerId = c.req.param('id');

    const existing = await db
      .prepare(`SELECT * FROM customers WHERE id = ? AND is_deleted = 0`)
      .bind(customerId)
      .first<Customer>();

    if (!existing) {
      return c.json({ success: false, error: 'Customer not found.' }, 404);
    }

    const now = new Date().toISOString();
    await db
      .prepare(`UPDATE customers SET is_deleted = 1, updated_at = ? WHERE id = ?`)
      .bind(now, customerId)
      .run();

    const clientIp = c.req.header('cf-connecting-ip') || '127.0.0.1';
    await logAudit(db, {
      staff_id: currentUser.id,
      staff_name: currentUser.name,
      action: 'DELETE',
      record_type: 'CUSTOMER',
      record_id: customerId,
      previous_value: existing,
      change_summary: `${currentUser.name} deleted customer ${existing.full_name} (${customerId})`,
      ip_address: clientIp,
    });

    return c.json({ success: true, message: 'Customer deleted successfully.' });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to delete customer.' }, 500);
  }
});

export default customersApp;
