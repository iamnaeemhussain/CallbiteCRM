import { Hono } from 'hono';
import { Env, StaffUser, EsimPackage } from '../types';
import { authMiddleware, adminOnlyMiddleware } from '../auth';
import { logAudit, generateId } from '../db';

const packagesApp = new Hono<{ Bindings: Env; Variables: { user: StaffUser } }>();

packagesApp.use('*', authMiddleware);

// List Packages
packagesApp.get('/', async (c) => {
  try {
    const db = c.env.DB;
    const { search, country, provider, status } = c.req.query();

    let query = `
      SELECT 
        p.*,
        prv.name AS provider_name_display,
        prv.code AS provider_code
      FROM packages p
      LEFT JOIN esim_providers prv ON p.provider_id = prv.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (status) {
      query += ` AND p.status = ?`;
      params.push(status);
    }

    if (country) {
      query += ` AND p.country_region LIKE ?`;
      params.push(`%${country}%`);
    }

    if (provider) {
      query += ` AND (p.provider LIKE ? OR prv.name LIKE ?)`;
      params.push(`%${provider}%`, `%${provider}%`);
    }

    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      query += ` AND (
        p.package_name LIKE ? OR
        p.country_region LIKE ? OR
        p.provider LIKE ? OR
        p.data_allowance LIKE ? OR
        p.id LIKE ?
      )`;
      params.push(s, s, s, s, s);
    }

    query += ` ORDER BY p.country_region ASC, p.selling_price ASC`;

    const results = await db.prepare(query).bind(...params).all<any>();

    return c.json({
      success: true,
      packages: results.results || [],
    });
  } catch (err: any) {
    console.error('List packages error:', err);
    return c.json({ success: true, packages: [] });
  }
});

// Single Package
packagesApp.get('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const pkgId = c.req.param('id');

    const pkg = await db
      .prepare(`SELECT * FROM packages WHERE id = ?`)
      .bind(pkgId)
      .first<EsimPackage>();

    if (!pkg) {
      return c.json({ success: false, error: 'Package not found.' }, 404);
    }

    return c.json({ success: true, package: pkg });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to load package.' }, 500);
  }
});

// Create Package
packagesApp.post('/', async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');
    const body = await c.req.json<{
      country_region: string;
      package_name: string;
      data_allowance: string;
      duration: string;
      provider: string;
      provider_id?: string;
      selling_price: number;
      cost_price: number;
      features?: string;
      status?: string;
      description?: string;
    }>();

    if (!body.package_name || !body.package_name.trim() || !body.country_region || !body.country_region.trim()) {
      return c.json({ success: false, error: 'Country/Region and Package Name are required.' }, 400);
    }

    const now = new Date().toISOString();
    const pkgId = await generateId(db, 'packages', 'PKG', 101);
    const sellPrice = Number(body.selling_price || 0);
    const costPrice = Number(body.cost_price || 0);
    const profit = sellPrice - costPrice;

    // Safe foreign key resolution for provider_id
    let validProviderId: string | null = null;
    if (body.provider_id && typeof body.provider_id === 'string' && body.provider_id.trim()) {
      const p = await db
        .prepare(`SELECT id FROM esim_providers WHERE id = ?`)
        .bind(body.provider_id.trim())
        .first<{ id: string }>();
      if (p) validProviderId = p.id;
    }
    if (!validProviderId && body.provider && typeof body.provider === 'string' && body.provider.trim()) {
      const p = await db
        .prepare(`SELECT id FROM esim_providers WHERE name = ?`)
        .bind(body.provider.trim())
        .first<{ id: string }>();
      if (p) validProviderId = p.id;
    }

    await db
      .prepare(
        `INSERT INTO packages (
          id, country_region, package_name, data_allowance, duration,
          provider, provider_id, selling_price, cost_price, profit,
          features, status, description, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        pkgId,
        body.country_region.trim(),
        body.package_name.trim(),
        body.data_allowance?.trim() || '10GB',
        body.duration?.trim() || '30 Days',
        body.provider?.trim() || 'Callbite Partner',
        validProviderId,
        sellPrice,
        costPrice,
        profit,
        body.features?.trim() || null,
        body.status || 'Active',
        body.description?.trim() || null,
        now,
        now
      )
      .run();

    const clientIp = c.req.header('cf-connecting-ip') || '127.0.0.1';
    await logAudit(db, {
      staff_id: currentUser.id,
      staff_name: currentUser.name,
      action: 'CREATE',
      record_type: 'PACKAGE',
      record_id: pkgId,
      new_value: { name: body.package_name, selling_price: sellPrice, cost_price: costPrice },
      change_summary: `${currentUser.name} created package bundle ${body.package_name.trim()} (Cost: Rs. ${costPrice}, Sell: Rs. ${sellPrice})`,
      ip_address: clientIp,
    });

    return c.json({
      success: true,
      message: 'eSIM Package created successfully.',
      package_id: pkgId,
    });
  } catch (err: any) {
    console.error('Create package error:', err);
    return c.json({ success: false, error: 'Failed to create package.' }, 500);
  }
});

// Update Package
packagesApp.put('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');
    const pkgId = c.req.param('id');
    const body = await c.req.json<Partial<EsimPackage>>();

    const existing = await db
      .prepare(`SELECT * FROM packages WHERE id = ?`)
      .bind(pkgId)
      .first<EsimPackage>();

    if (!existing) {
      return c.json({ success: false, error: 'Package not found.' }, 404);
    }

    const now = new Date().toISOString();
    const sellPrice = body.selling_price !== undefined ? Number(body.selling_price) : existing.selling_price;
    const costPrice = body.cost_price !== undefined ? Number(body.cost_price) : existing.cost_price;
    const profit = sellPrice - costPrice;

    // Safe foreign key resolution for provider_id
    let validProviderId = existing.provider_id;
    if (body.provider_id !== undefined) {
      if (body.provider_id && typeof body.provider_id === 'string' && body.provider_id.trim()) {
        const p = await db
          .prepare(`SELECT id FROM esim_providers WHERE id = ?`)
          .bind(body.provider_id.trim())
          .first<{ id: string }>();
        validProviderId = p ? p.id : null;
      } else {
        validProviderId = null;
      }
    } else if (body.provider && body.provider !== existing.provider) {
      const p = await db
        .prepare(`SELECT id FROM esim_providers WHERE name = ?`)
        .bind(body.provider.trim())
        .first<{ id: string }>();
      validProviderId = p ? p.id : null;
    }

    await db
      .prepare(
        `UPDATE packages SET
          country_region = ?,
          package_name = ?,
          data_allowance = ?,
          duration = ?,
          provider = ?,
          provider_id = ?,
          selling_price = ?,
          cost_price = ?,
          profit = ?,
          features = ?,
          status = ?,
          description = ?,
          updated_at = ?
         WHERE id = ?`
      )
      .bind(
        body.country_region !== undefined ? body.country_region.trim() : existing.country_region,
        body.package_name !== undefined ? body.package_name.trim() : existing.package_name,
        body.data_allowance !== undefined ? body.data_allowance : existing.data_allowance,
        body.duration !== undefined ? body.duration : existing.duration,
        body.provider !== undefined ? body.provider : existing.provider,
        validProviderId,
        sellPrice,
        costPrice,
        profit,
        body.features !== undefined ? body.features : existing.features,
        body.status || existing.status,
        body.description !== undefined ? body.description : existing.description,
        now,
        pkgId
      )
      .run();

    const clientIp = c.req.header('cf-connecting-ip') || '127.0.0.1';
    await logAudit(db, {
      staff_id: currentUser.id,
      staff_name: currentUser.name,
      action: 'UPDATE',
      record_type: 'PACKAGE',
      record_id: pkgId,
      previous_value: existing,
      new_value: body,
      change_summary: `${currentUser.name} updated package ${body.package_name || existing.package_name}`,
      ip_address: clientIp,
    });

    return c.json({ success: true, message: 'Package updated successfully.' });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to update package.' }, 500);
  }
});

// Delete Package
packagesApp.delete('/:id', adminOnlyMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');
    const pkgId = c.req.param('id');

    const existing = await db
      .prepare(`SELECT * FROM packages WHERE id = ?`)
      .bind(pkgId)
      .first<EsimPackage>();

    if (!existing) {
      return c.json({ success: false, error: 'Package not found.' }, 404);
    }

    await db.prepare(`DELETE FROM packages WHERE id = ?`).bind(pkgId).run();

    const clientIp = c.req.header('cf-connecting-ip') || '127.0.0.1';
    await logAudit(db, {
      staff_id: currentUser.id,
      staff_name: currentUser.name,
      action: 'DELETE',
      record_type: 'PACKAGE',
      record_id: pkgId,
      previous_value: existing,
      change_summary: `${currentUser.name} deleted package ${existing.package_name}`,
      ip_address: clientIp,
    });

    return c.json({ success: true, message: 'Package deleted successfully.' });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to delete package.' }, 500);
  }
});

export default packagesApp;
