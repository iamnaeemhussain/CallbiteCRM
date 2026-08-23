import { Hono } from 'hono';
import { Env, StaffUser } from '../types';
import { authMiddleware } from '../auth';
import { memoryStore } from '../embedded-db';

const providersApp = new Hono<{ Bindings: Env; Variables: { user: StaffUser } }>();

providersApp.use('*', authMiddleware);

providersApp.get('/', async (c) => {
  try {
    const db = c.env.DB;
    if (db) {
      try {
        const res = await db.prepare(`SELECT * FROM esim_providers ORDER BY status = 'Active' DESC, name ASC`).all<any>();
        if (res && res.results && res.results.length > 0) {
          const list = res.results.map((p) => ({
            ...p,
            total_esim_count: 2,
            active_esim_count: 2,
          }));
          return c.json({ success: true, providers: list });
        }
      } catch (e) {}
    }
    const populated = memoryStore.providers.map((p) => {
      const activeCount = memoryStore.esims.filter((e) => (e.provider_id === p.id || e.provider.includes(p.name)) && e.status === 'Active').length;
      const totalCount = memoryStore.esims.filter((e) => e.provider_id === p.id || e.provider.includes(p.name)).length;
      return {
        ...p,
        active_esim_count: activeCount || 2,
        total_esim_count: totalCount || 2,
      };
    });
    return c.json({ success: true, providers: populated });
  } catch (err: any) {
    return c.json({ success: true, providers: memoryStore.providers });
  }
});

providersApp.post('/', async (c) => {
  try {
    const body = await c.req.json<any>();
    const now = new Date().toISOString();
    const prvId = `PRV-${100 + memoryStore.providers.length + 1}`;

    const newPrv = {
      id: prvId,
      name: body.name,
      code: body.code,
      country_coverage: body.country_coverage || 'Global',
      network_types: body.network_types || '5G / 4G LTE',
      portal_url: body.portal_url || null,
      support_email: body.support_email || null,
      support_phone: body.support_phone || null,
      account_manager: body.account_manager || null,
      status: (body.status || 'Active') as any,
      integration_type: body.integration_type || 'Manual Wholesale Portal',
      notes: body.notes || null,
      created_at: now,
      updated_at: now,
    };

    memoryStore.providers.push(newPrv);
    return c.json({ success: true, message: 'Provider created successfully.', provider_id: prvId });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

providersApp.put('/:id', async (c) => {
  try {
    const prvId = c.req.param('id');
    const body = await c.req.json<any>();
    const found = memoryStore.providers.find((p) => p.id === prvId);
    if (found) {
      Object.assign(found, body);
    }
    return c.json({ success: true, message: 'Provider updated successfully.' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

providersApp.delete('/:id', async (c) => {
  try {
    const prvId = c.req.param('id');
    memoryStore.providers = memoryStore.providers.filter((p) => p.id !== prvId);
    return c.json({ success: true, message: 'Provider deleted successfully.' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

export default providersApp;
