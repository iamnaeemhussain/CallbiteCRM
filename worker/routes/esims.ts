import { Hono } from 'hono';
import { Env, StaffUser, Esim } from '../types';
import { authMiddleware } from '../auth';
import { logTimeline, logAudit, generateId } from '../db';

const esimsApp = new Hono<{ Bindings: Env; Variables: { user: StaffUser } }>();

esimsApp.use('*', authMiddleware);

async function ensureHolderColumns(db: D1Database) {
  for (const sql of [`ALTER TABLE esims ADD COLUMN holder_name TEXT`, `ALTER TABLE esims ADD COLUMN holder_phone TEXT`]) {
    try {
      await db.prepare(sql).run();
    } catch {
      // column already exists
    }
  }
}

esimsApp.put('/:id/holder', async (c) => {
  try {
    const db = c.env.DB;
    await ensureHolderColumns(db);
    const esimId = c.req.param('id');
    const body = await c.req.json<{ full_name?: string; whatsapp_number?: string }>();
    const fullName = (body.full_name || '').trim();
    const phone = (body.whatsapp_number || '').trim();

    if (!fullName) return c.json({ success: false, error: 'Name is required.' }, 400);
    if (!phone) return c.json({ success: false, error: 'WhatsApp number is required.' }, 400);

    const esim = await db.prepare(`SELECT * FROM esims WHERE id = ? AND is_deleted = 0`).bind(esimId).first<any>();
    if (!esim) return c.json({ success: false, error: 'eSIM not found.' }, 404);

    const now = new Date().toISOString();
    await db
      .prepare(`UPDATE esims SET holder_name = ?, holder_phone = ?, updated_at = ? WHERE id = ?`)
      .bind(fullName, phone, now, esimId)
      .run();

    return c.json({
      success: true,
      message: 'Name saved for this ICCID.',
      holder_name: fullName,
      holder_phone: phone,
    });
  } catch (err: any) {
    console.error('Assign holder error:', err);
    return c.json({ success: false, error: err.message || 'Failed to save user profile.' }, 500);
  }
});

// List eSIMs
esimsApp.get('/', async (c) => {
  try {
    const db = c.env.DB;
    await ensureHolderColumns(db);
    const {
      search,
      status,
      country,
      provider,
      customer_id,
      expiry_range,
      sort_by = 'created_at',
      order = 'desc',
      page = '1',
      limit = '50',
    } = c.req.query();

    let query = `
      SELECT 
        e.*,
        COALESCE(e.holder_name, c.full_name, 'Unassigned') AS customer_name,
        COALESCE(e.holder_phone, c.whatsapp_number) AS customer_phone,
        u.name AS created_by_staff_name
      FROM esims e
      LEFT JOIN customers c ON e.customer_id = c.id
      LEFT JOIN users u ON e.created_by_staff_id = u.id
      WHERE e.is_deleted = 0
    `;

    const params: any[] = [];

    if (customer_id) {
      query += ` AND e.customer_id = ?`;
      params.push(customer_id);
    }

    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      query += ` AND (
        e.iccid LIKE ? OR
        e.id LIKE ? OR
        e.package_name LIKE ? OR
        e.country_region LIKE ? OR
        e.provider LIKE ? OR
        e.tag LIKE ? OR
        c.full_name LIKE ? OR
        c.whatsapp_number LIKE ?
      )`;
      params.push(s, s, s, s, s, s, s, s, s, s);
    }

    if (status) {
      query += ` AND e.status = ?`;
      params.push(status);
    }

    if (country) {
      query += ` AND e.country_region LIKE ?`;
      params.push(`%${country}%`);
    }

    if (provider) {
      query += ` AND e.provider LIKE ?`;
      params.push(`%${provider}%`);
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
        query += ` AND e.expiry_date < ?`;
        params.push(todayStr);
      } else if (expiry_range === 'today') {
        query += ` AND e.expiry_date = ?`;
        params.push(todayStr);
      } else if (expiry_range === '3_days') {
        query += ` AND e.expiry_date >= ? AND e.expiry_date <= ?`;
        params.push(todayStr, addDays(3));
      } else if (expiry_range === '7_days') {
        query += ` AND e.expiry_date >= ? AND e.expiry_date <= ?`;
        params.push(todayStr, addDays(7));
      }
    }

    const sortCol = sort_by === 'created_at' ? 'e.created_at' : sort_by === 'expiry_date' ? 'e.expiry_date' : 'e.created_at';
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

    return c.json({
      success: true,
      esims: results.results || [],
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err: any) {
    console.error('List esims error:', err);
    return c.json({ success: true, esims: [], pagination: { total: 0, page: 1, limit: 50, totalPages: 1 } });
  }
});

// Single eSIM
esimsApp.get('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const esimId = c.req.param('id');

    const esim = await db
      .prepare(
        `SELECT 
          e.*,
          c.full_name AS customer_name,
          c.whatsapp_number AS customer_phone,
          c.email AS customer_email,
          c.status AS customer_status,
          u.name AS created_by_staff_name
         FROM esims e
         JOIN customers c ON e.customer_id = c.id
         LEFT JOIN users u ON e.created_by_staff_id = u.id
         WHERE e.id = ? AND e.is_deleted = 0`
      )
      .bind(esimId)
      .first<any>();

    if (!esim) {
      return c.json({ success: false, error: 'eSIM not found.' }, 404);
    }

    return c.json({
      success: true,
      esim,
    });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to load eSIM.' }, 500);
  }
});

// Create eSIM
esimsApp.post('/', async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');
    const body = await c.req.json<{
      customer_id: string;
      iccid: string;
      country_region: string;
      provider: string;
      provider_id?: string;
      package_name: string;
      package_id?: string;
      data_allowance: string;
      duration: string;
      start_date?: string;
      expiry_date: string;
      activation_date?: string;
      status?: string;
      qr_code_data?: string;
      apn_info?: string;
      tag?: string;
      notes?: string;
      selling_price?: number;
      cost_price?: number;
      payment_method?: string;
      record_transaction?: boolean;
    }>();

    if (!body.customer_id) {
      return c.json({ success: false, error: 'Customer is required.' }, 400);
    }
    if (!body.iccid || !body.iccid.trim()) {
      return c.json({ success: false, error: 'ICCID is required.' }, 400);
    }
    if (!body.package_name || !body.expiry_date) {
      return c.json({ success: false, error: 'Package Name and Expiry Date are required.' }, 400);
    }

    const dup = await db
      .prepare(`SELECT id FROM esims WHERE iccid = ? AND is_deleted = 0`)
      .bind(body.iccid.trim())
      .first<{ id: string }>();

    if (dup) {
      return c.json({ success: false, error: `ICCID "${body.iccid.trim()}" already exists in the system (eSIM ID: ${dup.id}).` }, 400);
    }

    const customer = await db
      .prepare(`SELECT id, full_name FROM customers WHERE id = ? AND is_deleted = 0`)
      .bind(body.customer_id)
      .first<{ id: string; full_name: string }>();

    if (!customer) {
      return c.json({ success: false, error: 'Target customer does not exist.' }, 404);
    }

    const validProviderId: string | null = null;
    const validPackageId: string | null = null;

    // Safe Foreign Key resolution for staff_id
    let validStaffId: string | null = null;
    if (currentUser?.id) {
      const u = await db
        .prepare(`SELECT id FROM users WHERE id = ?`)
        .bind(currentUser.id)
        .first<{ id: string }>();
      if (u) {
        validStaffId = u.id;
      }
    }

    const now = new Date().toISOString();
    const esimId = await generateId(db, 'esims', 'ESIM', 2001);

    await db
      .prepare(
        `INSERT INTO esims (
          id, customer_id, iccid, country_region, provider, provider_id,
          package_name, package_id, data_allowance, duration, start_date,
          expiry_date, renewal_date, activation_date, status, qr_code_data,
          apn_info, tag, notes, created_by_staff_id, is_deleted, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
      )
      .bind(
        esimId,
        body.customer_id,
        body.iccid.trim(),
        body.country_region || 'Pakistan',
        body.provider || 'Callbite Partner',
        validProviderId,
        body.package_name.trim(),
        validPackageId,
        body.data_allowance || '10GB',
        body.duration || '30 Days',
        body.start_date || now.slice(0, 10),
        body.expiry_date,
        body.activation_date || now.slice(0, 10),
        body.status || 'Active',
        body.qr_code_data?.trim() || null,
        body.apn_info?.trim() || null,
        body.tag?.trim() || 'Primary SIM',
        body.notes?.trim() || null,
        validStaffId,
        now,
        now
      )
      .run();

    await logTimeline(db, {
      customer_id: body.customer_id,
      staff_id: validStaffId,
      action_type: 'ESIM_ADDED',
      title: `eSIM Added: ${body.package_name}`,
      description: `${currentUser.name} added ${body.package_name} (${body.data_allowance}) - ICCID: ${body.iccid.trim()}${body.tag ? ' [' + body.tag + ']' : ''}. Expires ${body.expiry_date}.`,
      metadata: { iccid: body.iccid.trim(), package: body.package_name, expiry_date: body.expiry_date, tag: body.tag },
    });

    const clientIp = c.req.header('cf-connecting-ip') || '127.0.0.1';
    await logAudit(db, {
      staff_id: validStaffId || currentUser.id,
      staff_name: currentUser.name,
      action: 'CREATE',
      record_type: 'ESIM',
      record_id: esimId,
      new_value: { customer_id: body.customer_id, iccid: body.iccid, package: body.package_name, tag: body.tag },
      change_summary: `Added eSIM ${body.package_name} (${body.iccid}) for ${customer.full_name}`,
      ip_address: clientIp,
    });

    return c.json({
      success: true,
      message: 'eSIM added successfully.',
      esim_id: esimId,
    });
  } catch (err: any) {
    console.error('Create esim error:', err);
    return c.json({ success: false, error: err.message || 'Failed to create eSIM.' }, 500);
  }
});


// Update eSIM
esimsApp.put('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');
    const esimId = c.req.param('id');
    const body = await c.req.json<Partial<Esim>>();

    const existing = await db
      .prepare(`SELECT * FROM esims WHERE id = ? AND is_deleted = 0`)
      .bind(esimId)
      .first<Esim>();

    if (!existing) {
      return c.json({ success: false, error: 'eSIM not found.' }, 404);
    }

    if (body.iccid && body.iccid.trim() !== existing.iccid) {
      const dup = await db
        .prepare(`SELECT id FROM esims WHERE iccid = ? AND id != ? AND is_deleted = 0`)
        .bind(body.iccid.trim(), esimId)
        .first<{ id: string }>();

      if (dup) {
        return c.json({ success: false, error: `ICCID "${body.iccid.trim()}" is already assigned to another eSIM.` }, 400);
      }
    }

    const now = new Date().toISOString();
    const changes: string[] = [];

    if (body.package_name && body.package_name !== existing.package_name) {
      changes.push(`Package: ${existing.package_name} → ${body.package_name}`);
    }
    if (body.data_allowance && body.data_allowance !== existing.data_allowance) {
      changes.push(`Data: ${existing.data_allowance} → ${body.data_allowance}`);
    }
    if (body.expiry_date && body.expiry_date !== existing.expiry_date) {
      changes.push(`Expiry: ${existing.expiry_date} → ${body.expiry_date}`);
    }
    if (body.status && body.status !== existing.status) {
      changes.push(`Status: ${existing.status} → ${body.status}`);
    }
    if (body.tag && body.tag !== existing.tag) {
      changes.push(`Tag: ${existing.tag || 'None'} → ${body.tag}`);
    }

    await db
      .prepare(
        `UPDATE esims SET
          iccid = ?,
          country_region = ?,
          provider = ?,
          provider_id = NULL,
          package_name = ?,
          package_id = NULL,
          data_allowance = ?,
          duration = ?,
          start_date = ?,
          expiry_date = ?,
          renewal_date = ?,
          activation_date = ?,
          status = ?,
          qr_code_data = ?,
          apn_info = ?,
          tag = ?,
          notes = ?,
          updated_at = ?
         WHERE id = ?`
      )
      .bind(
        body.iccid !== undefined ? body.iccid.trim() : existing.iccid,
        body.country_region !== undefined ? body.country_region : existing.country_region,
        body.provider !== undefined ? body.provider : existing.provider,
        body.package_name !== undefined ? body.package_name.trim() : existing.package_name,
        body.data_allowance !== undefined ? body.data_allowance : existing.data_allowance,
        body.duration !== undefined ? body.duration : existing.duration,
        body.start_date !== undefined ? body.start_date : existing.start_date,
        body.expiry_date !== undefined ? body.expiry_date : existing.expiry_date,
        body.renewal_date !== undefined ? body.renewal_date : existing.renewal_date,
        body.activation_date !== undefined ? body.activation_date : existing.activation_date,
        body.status !== undefined ? body.status : existing.status,
        body.qr_code_data !== undefined ? body.qr_code_data : existing.qr_code_data,
        body.apn_info !== undefined ? body.apn_info : existing.apn_info,
        body.tag !== undefined ? body.tag : existing.tag,
        body.notes !== undefined ? body.notes : existing.notes,
        now,
        esimId
      )
      .run();

    if (changes.length > 0) {
      const summaryText = `${currentUser.name} changed ${changes.join(', ')}`;
      await logTimeline(db, {
        customer_id: existing.customer_id,
        staff_id: currentUser.id,
        action_type: 'ESIM_UPDATED',
        title: `eSIM Updated (${existing.package_name})`,
        description: summaryText,
        metadata: { esim_id: esimId, changes },
      });

      const clientIp = c.req.header('cf-connecting-ip') || '127.0.0.1';
      await logAudit(db, {
        staff_id: currentUser.id,
        staff_name: currentUser.name,
        action: 'UPDATE',
        record_type: 'ESIM',
        record_id: esimId,
        previous_value: existing,
        new_value: body,
        change_summary: summaryText,
        ip_address: clientIp,
      });
    }

    return c.json({ success: true, message: 'eSIM updated successfully.' });
  } catch (err: any) {
    console.error('Update esim error:', err);
    return c.json({ success: false, error: 'Failed to update eSIM.' }, 500);
  }
});

// Delete eSIM
esimsApp.delete('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');
    const esimId = c.req.param('id');

    const existing = await db
      .prepare(`SELECT * FROM esims WHERE id = ? AND is_deleted = 0`)
      .bind(esimId)
      .first<Esim>();

    if (!existing) {
      return c.json({ success: false, error: 'eSIM not found.' }, 404);
    }

    const now = new Date().toISOString();
    await db
      .prepare(`UPDATE esims SET is_deleted = 1, status = 'Cancelled', updated_at = ? WHERE id = ?`)
      .bind(now, esimId)
      .run();

    await logTimeline(db, {
      customer_id: existing.customer_id,
      staff_id: currentUser.id,
      action_type: 'ESIM_CANCELLED',
      title: `eSIM Cancelled / Removed: ${existing.package_name}`,
      description: `${currentUser.name} removed eSIM with ICCID ${existing.iccid}.`,
    });

    const clientIp = c.req.header('cf-connecting-ip') || '127.0.0.1';
    await logAudit(db, {
      staff_id: currentUser.id,
      staff_name: currentUser.name,
      action: 'DELETE',
      record_type: 'ESIM',
      record_id: esimId,
      previous_value: existing,
      change_summary: `${currentUser.name} deleted eSIM ${existing.iccid}`,
      ip_address: clientIp,
    });

    return c.json({ success: true, message: 'eSIM deleted successfully.' });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to delete eSIM.' }, 500);
  }
});

export default esimsApp;
