import { Hono } from 'hono';
import { Env, StaffUser, EsimProvider } from '../types';
import { authMiddleware, adminOnlyMiddleware } from '../auth';
import { logAudit, generateId } from '../db';

const providersApp = new Hono<{ Bindings: Env; Variables: { user: StaffUser } }>();

providersApp.use('*', authMiddleware);

// List all eSIM Providers
providersApp.get('/', async (c) => {
  try {
    const db = c.env.DB;
    const { search, status } = c.req.query();

    let query = `
      SELECT 
        p.*,
        (SELECT COUNT(*) FROM esims e WHERE (e.provider_id = p.id OR e.provider LIKE ('%' || p.name || '%')) AND e.is_deleted = 0) AS total_esim_count,
        (SELECT COUNT(*) FROM esims e WHERE (e.provider_id = p.id OR e.provider LIKE ('%' || p.name || '%')) AND e.is_deleted = 0 AND e.status = 'Active') AS active_esim_count
      FROM esim_providers p
      WHERE 1=1
    `;

    const params: any[] = [];

    if (status) {
      query += ` AND p.status = ?`;
      params.push(status);
    }

    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      query += ` AND (p.name LIKE ? OR p.code LIKE ? OR p.country_coverage LIKE ? OR p.account_manager LIKE ?)`;
      params.push(s, s, s, s);
    }

    query += ` ORDER BY p.status = 'Active' DESC, p.name ASC`;

    const providers = await db.prepare(query).bind(...params).all<any>();

    return c.json({
      success: true,
      providers: providers.results || [],
    });
  } catch (err: any) {
    console.error('List providers error:', err);
    return c.json({ success: false, error: 'Failed to load eSIM providers.' }, 500);
  }
});

// Single Provider Details with Associated eSIMs
providersApp.get('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const providerId = c.req.param('id');

    const provider = await db
      .prepare(
        `SELECT 
          p.*,
          (SELECT COUNT(*) FROM esims e WHERE (e.provider_id = p.id OR e.provider LIKE ('%' || p.name || '%')) AND e.is_deleted = 0) AS total_esim_count,
          (SELECT COUNT(*) FROM esims e WHERE (e.provider_id = p.id OR e.provider LIKE ('%' || p.name || '%')) AND e.is_deleted = 0 AND e.status = 'Active') AS active_esim_count
         FROM esim_providers p
         WHERE p.id = ?`
      )
      .bind(providerId)
      .first<any>();

    if (!provider) {
      return c.json({ success: false, error: 'Provider not found.' }, 404);
    }

    const esims = await db
      .prepare(
        `SELECT e.*, c.full_name AS customer_name, c.whatsapp_number AS customer_phone
         FROM esims e
         JOIN customers c ON e.customer_id = c.id
         WHERE (e.provider_id = ? OR e.provider LIKE ('%' || ? || '%')) AND e.is_deleted = 0
         ORDER BY e.created_at DESC LIMIT 50`
      )
      .bind(providerId, provider.name)
      .all<any>();

    return c.json({
      success: true,
      provider,
      esims: esims.results || [],
    });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to load provider details.' }, 500);
  }
});

// Create Provider (Admin only)
providersApp.post('/', adminOnlyMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');
    const body = await c.req.json<{
      name: string;
      code: string;
      country_coverage: string;
      network_types?: string;
      portal_url?: string;
      support_email?: string;
      support_phone?: string;
      account_manager?: string;
      status?: string;
      integration_type?: string;
      notes?: string;
    }>();

    if (!body.name || !body.name.trim() || !body.code || !body.code.trim()) {
      return c.json({ success: false, error: 'Provider Name and Code are required.' }, 400);
    }

    const existing = await db
      .prepare(`SELECT id FROM esim_providers WHERE LOWER(code) = LOWER(?) OR LOWER(name) = LOWER(?)`)
      .bind(body.code.trim(), body.name.trim())
      .first<{ id: string }>();

    if (existing) {
      return c.json({ success: false, error: 'A provider with this Name or Code already exists.' }, 400);
    }

    const now = new Date().toISOString();
    const providerId = await generateId(db, 'esim_providers', 'PRV', 109);

    await db
      .prepare(
        `INSERT INTO esim_providers (
          id, name, code, country_coverage, network_types, portal_url,
          support_email, support_phone, account_manager, status,
          integration_type, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        providerId,
        body.name.trim(),
        body.code.trim().toUpperCase(),
        body.country_coverage?.trim() || 'Global',
        body.network_types?.trim() || '5G / 4G LTE',
        body.portal_url?.trim() || null,
        body.support_email?.trim() || null,
        body.support_phone?.trim() || null,
        body.account_manager?.trim() || null,
        body.status || 'Active',
        body.integration_type || 'Manual Wholesale Portal',
        body.notes?.trim() || null,
        now,
        now
      )
      .run();

    const clientIp = c.req.header('cf-connecting-ip') || '127.0.0.1';
    await logAudit(db, {
      staff_id: currentUser.id,
      staff_name: currentUser.name,
      action: 'CREATE',
      record_type: 'PROVIDER',
      record_id: providerId,
      new_value: { name: body.name, code: body.code },
      change_summary: `${currentUser.name} added eSIM provider ${body.name.trim()} (${body.code.trim()})`,
      ip_address: clientIp,
    });

    return c.json({
      success: true,
      message: 'eSIM Provider created successfully.',
      provider_id: providerId,
    });
  } catch (err: any) {
    console.error('Create provider error:', err);
    return c.json({ success: false, error: 'Failed to create provider.' }, 500);
  }
});

// Update Provider (Admin only)
providersApp.put('/:id', adminOnlyMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');
    const providerId = c.req.param('id');
    const body = await c.req.json<Partial<EsimProvider>>();

    const existing = await db
      .prepare(`SELECT * FROM esim_providers WHERE id = ?`)
      .bind(providerId)
      .first<EsimProvider>();

    if (!existing) {
      return c.json({ success: false, error: 'Provider not found.' }, 404);
    }

    const now = new Date().toISOString();

    await db
      .prepare(
        `UPDATE esim_providers SET
          name = ?,
          code = ?,
          country_coverage = ?,
          network_types = ?,
          portal_url = ?,
          support_email = ?,
          support_phone = ?,
          account_manager = ?,
          status = ?,
          integration_type = ?,
          notes = ?,
          updated_at = ?
         WHERE id = ?`
      )
      .bind(
        body.name !== undefined ? body.name.trim() : existing.name,
        body.code !== undefined ? body.code.trim().toUpperCase() : existing.code,
        body.country_coverage !== undefined ? body.country_coverage : existing.country_coverage,
        body.network_types !== undefined ? body.network_types : existing.network_types,
        body.portal_url !== undefined ? body.portal_url?.trim() || null : existing.portal_url,
        body.support_email !== undefined ? body.support_email?.trim() || null : existing.support_email,
        body.support_phone !== undefined ? body.support_phone?.trim() || null : existing.support_phone,
        body.account_manager !== undefined ? body.account_manager?.trim() || null : existing.account_manager,
        body.status || existing.status,
        body.integration_type || existing.integration_type,
        body.notes !== undefined ? body.notes?.trim() || null : existing.notes,
        now,
        providerId
      )
      .run();

    const clientIp = c.req.header('cf-connecting-ip') || '127.0.0.1';
    await logAudit(db, {
      staff_id: currentUser.id,
      staff_name: currentUser.name,
      action: 'UPDATE',
      record_type: 'PROVIDER',
      record_id: providerId,
      previous_value: existing,
      new_value: body,
      change_summary: `${currentUser.name} updated eSIM provider ${body.name || existing.name}`,
      ip_address: clientIp,
    });

    return c.json({ success: true, message: 'Provider updated successfully.' });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to update provider.' }, 500);
  }
});

// Delete Provider (Admin only)
providersApp.delete('/:id', adminOnlyMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');
    const providerId = c.req.param('id');

    const existing = await db
      .prepare(`SELECT * FROM esim_providers WHERE id = ?`)
      .bind(providerId)
      .first<EsimProvider>();

    if (!existing) {
      return c.json({ success: false, error: 'Provider not found.' }, 404);
    }

    await db.prepare(`DELETE FROM esim_providers WHERE id = ?`).bind(providerId).run();

    const clientIp = c.req.header('cf-connecting-ip') || '127.0.0.1';
    await logAudit(db, {
      staff_id: currentUser.id,
      staff_name: currentUser.name,
      action: 'DELETE',
      record_type: 'PROVIDER',
      record_id: providerId,
      previous_value: existing,
      change_summary: `${currentUser.name} deleted eSIM provider ${existing.name}`,
      ip_address: clientIp,
    });

    return c.json({ success: true, message: 'Provider deleted successfully.' });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to delete provider.' }, 500);
  }
});

export default providersApp;
