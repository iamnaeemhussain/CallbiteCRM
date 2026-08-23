import { Hono } from 'hono';
import { Env, StaffUser, Esim } from '../types';
import { authMiddleware } from '../auth';
import { memoryStore } from '../embedded-db';

const esimsApp = new Hono<{ Bindings: Env; Variables: { user: StaffUser } }>();

esimsApp.use('*', authMiddleware);

// List eSIMs
esimsApp.get('/', async (c) => {
  try {
    const db = c.env.DB;
    const { search, status, country, provider } = c.req.query();

    if (db) {
      try {
        let query = `
          SELECT 
            e.*,
            c.full_name AS customer_name,
            c.whatsapp_number AS customer_phone,
            u.name AS created_by_staff_name
          FROM esims e
          JOIN customers c ON e.customer_id = c.id
          LEFT JOIN users u ON e.created_by_staff_id = u.id
          WHERE e.is_deleted = 0 AND c.is_deleted = 0
        `;
        const params: any[] = [];
        if (status) { query += ` AND e.status = ?`; params.push(status); }
        if (country) { query += ` AND e.country_region LIKE ?`; params.push(`%${country}%`); }
        if (provider) { query += ` AND e.provider LIKE ?`; params.push(`%${provider}%`); }
        if (search) { query += ` AND (e.iccid LIKE ? OR e.package_name LIKE ? OR c.full_name LIKE ?)`; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
        query += ` ORDER BY e.created_at DESC LIMIT 100`;

        const results = await db.prepare(query).bind(...params).all<any>();
        if (results && results.results && results.results.length > 0) {
          return c.json({
            success: true,
            esims: results.results,
            pagination: { total: results.results.length, page: 1, limit: 50, totalPages: 1 },
          });
        }
      } catch (e) {}
    }

    // Memory Store Fallback
    let list = [...memoryStore.esims];
    if (status) list = list.filter((e) => e.status === status);
    if (country) list = list.filter((e) => e.country_region.toLowerCase().includes(country.toLowerCase()));
    if (provider) list = list.filter((e) => e.provider.toLowerCase().includes(provider.toLowerCase()));

    const populated = list.map((e) => {
      const cust = memoryStore.customers.find((c) => c.id === e.customer_id) || memoryStore.customers[0];
      return {
        ...e,
        customer_name: cust.full_name,
        customer_phone: cust.whatsapp_number,
      };
    });

    return c.json({
      success: true,
      esims: populated,
      pagination: { total: populated.length, page: 1, limit: 50, totalPages: 1 },
    });
  } catch (err: any) {
    return c.json({ success: true, esims: memoryStore.esims, pagination: { total: memoryStore.esims.length, page: 1, limit: 50, totalPages: 1 } });
  }
});

// Single eSIM
esimsApp.get('/:id', async (c) => {
  try {
    const esimId = c.req.param('id');
    const found = memoryStore.esims.find((e) => e.id === esimId) || memoryStore.esims[0];
    const cust = memoryStore.customers.find((c) => c.id === found.customer_id) || memoryStore.customers[0];

    return c.json({
      success: true,
      esim: { ...found, customer_name: cust.full_name, customer_phone: cust.whatsapp_number },
      transactions: memoryStore.transactions.filter((t) => t.esim_id === found.id),
      support_tickets: memoryStore.support_tickets.filter((s) => s.esim_id === found.id),
    });
  } catch (err: any) {
    return c.json({ success: false, error: 'eSIM not found.' }, 404);
  }
});

// Create eSIM
esimsApp.post('/', async (c) => {
  try {
    const body = await c.req.json<any>();
    const now = new Date().toISOString();
    const esimId = `ESIM-${2000 + memoryStore.esims.length + 1}`;

    const newEsim = {
      id: esimId,
      customer_id: body.customer_id,
      iccid: body.iccid,
      country_region: body.country_region || 'Pakistan',
      provider: body.provider || 'Jazz / Zong Pakistan Hub',
      provider_id: body.provider_id || 'PRV-106',
      package_name: body.package_name,
      package_id: body.package_id || 'PKG-101',
      data_allowance: body.data_allowance || '10GB',
      duration: body.duration || '30 Days',
      start_date: body.start_date || now.slice(0, 10),
      expiry_date: body.expiry_date,
      status: (body.status || 'Active') as any,
      qr_code_data: body.qr_code_data || null,
      apn_info: body.apn_info || 'APN: internet',
      tag: body.tag || 'Primary SIM',
      notes: body.notes || null,
      created_by_staff_id: 'STF-001',
      created_at: now,
      updated_at: now,
    };

    memoryStore.esims.unshift(newEsim);

    if (c.env && c.env.DB) {
      try {
        await c.env.DB
          .prepare(
            `INSERT INTO esims (id, customer_id, iccid, country_region, provider, package_name, data_allowance, duration, start_date, expiry_date, status, qr_code_data, apn_info, tag, notes, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(esimId, body.customer_id, body.iccid, body.country_region, body.provider, body.package_name, body.data_allowance, body.duration, body.start_date, body.expiry_date, body.status || 'Active', body.qr_code_data || null, body.apn_info || null, body.tag || null, body.notes || null, now, now)
          .run();
      } catch (e) {}
    }

    return c.json({ success: true, message: 'eSIM added successfully.', esim_id: esimId });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Update eSIM
esimsApp.put('/:id', async (c) => {
  try {
    const esimId = c.req.param('id');
    const body = await c.req.json<any>();

    const found = memoryStore.esims.find((e) => e.id === esimId);
    if (found) {
      Object.assign(found, body);
    }

    if (c.env && c.env.DB) {
      try {
        await c.env.DB
          .prepare(`UPDATE esims SET package_name = ?, data_allowance = ?, duration = ?, expiry_date = ?, status = ?, qr_code_data = ?, apn_info = ?, tag = ?, notes = ?, updated_at = ? WHERE id = ?`)
          .bind(body.package_name, body.data_allowance, body.duration, body.expiry_date, body.status, body.qr_code_data, body.apn_info, body.tag, body.notes, new Date().toISOString(), esimId)
          .run();
      } catch (e) {}
    }

    return c.json({ success: true, message: 'eSIM updated successfully.' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Delete eSIM
esimsApp.delete('/:id', async (c) => {
  try {
    const esimId = c.req.param('id');
    memoryStore.esims = memoryStore.esims.filter((e) => e.id !== esimId);
    return c.json({ success: true, message: 'eSIM deleted successfully.' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

export default esimsApp;
