import { Hono } from 'hono';
import { Env, StaffUser } from '../types';
import { authMiddleware } from '../auth';
import { memoryStore } from '../embedded-db';

const packagesApp = new Hono<{ Bindings: Env; Variables: { user: StaffUser } }>();

packagesApp.use('*', authMiddleware);

packagesApp.get('/', async (c) => {
  try {
    const db = c.env.DB;
    if (db) {
      try {
        const res = await db.prepare(`SELECT * FROM packages ORDER BY country_region ASC, selling_price ASC`).all<any>();
        if (res && res.results && res.results.length > 0) {
          return c.json({ success: true, packages: res.results });
        }
      } catch (e) {}
    }
    return c.json({ success: true, packages: memoryStore.packages });
  } catch (err: any) {
    return c.json({ success: true, packages: memoryStore.packages });
  }
});

packagesApp.post('/', async (c) => {
  try {
    const body = await c.req.json<any>();
    const now = new Date().toISOString();
    const pkgId = `PKG-${100 + memoryStore.packages.length + 1}`;
    const sellPrice = Number(body.selling_price || 0);
    const costPrice = Number(body.cost_price || 0);

    const newPkg = {
      id: pkgId,
      country_region: body.country_region,
      package_name: body.package_name,
      data_allowance: body.data_allowance || '10GB',
      duration: body.duration || '30 Days',
      provider: body.provider || 'Partner',
      provider_id: body.provider_id || 'PRV-101',
      selling_price: sellPrice,
      cost_price: costPrice,
      profit: sellPrice - costPrice,
      features: body.features || null,
      status: (body.status || 'Active') as any,
      description: body.description || null,
      created_at: now,
      updated_at: now,
    };

    memoryStore.packages.push(newPkg);

    if (c.env && c.env.DB) {
      try {
        await c.env.DB
          .prepare(`INSERT INTO packages (id, country_region, package_name, data_allowance, duration, provider, provider_id, selling_price, cost_price, profit, features, status, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(pkgId, body.country_region, body.package_name, body.data_allowance, body.duration, body.provider, body.provider_id, sellPrice, costPrice, sellPrice - costPrice, body.features, body.status || 'Active', body.description, now, now)
          .run();
      } catch (e) {}
    }

    return c.json({ success: true, message: 'Package created successfully.', package_id: pkgId });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

packagesApp.put('/:id', async (c) => {
  try {
    const pkgId = c.req.param('id');
    const body = await c.req.json<any>();
    const found = memoryStore.packages.find((p) => p.id === pkgId);
    if (found) {
      Object.assign(found, body);
      found.profit = (Number(found.selling_price) || 0) - (Number(found.cost_price) || 0);
    }
    return c.json({ success: true, message: 'Package updated successfully.' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

packagesApp.delete('/:id', async (c) => {
  try {
    const pkgId = c.req.param('id');
    memoryStore.packages = memoryStore.packages.filter((p) => p.id !== pkgId);
    return c.json({ success: true, message: 'Package deleted successfully.' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

export default packagesApp;
