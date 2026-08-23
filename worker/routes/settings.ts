import { Hono } from 'hono';
import { Env, StaffUser } from '../types';
import { authMiddleware, adminOnlyMiddleware } from '../auth';
import { memoryStore } from '../embedded-db';

const settingsApp = new Hono<{ Bindings: Env; Variables: { user: StaffUser } }>();

settingsApp.use('*', authMiddleware);

settingsApp.get('/', async (c) => {
  try {
    const db = c.env.DB;
    if (db) {
      try {
        const settingsRows = await db.prepare(`SELECT key, value, description FROM settings`).all<{ key: string; value: string; description: string }>();
        const settingsMap: Record<string, string> = {};
        (settingsRows.results || []).forEach((row) => {
          settingsMap[row.key] = row.value;
        });

        const tags = await db.prepare(`SELECT * FROM tags ORDER BY name ASC`).all<any>();
        const presets = await db.prepare(`SELECT * FROM package_presets WHERE is_active = 1 ORDER BY country_region ASC, package_name ASC`).all<any>();

        if (Object.keys(settingsMap).length > 0) {
          return c.json({
            success: true,
            settings: settingsMap,
            tags: tags.results || memoryStore.tags,
            package_presets: presets.results || memoryStore.packages,
          });
        }
      } catch (e) {}
    }

    return c.json({
      success: true,
      settings: memoryStore.settings,
      tags: memoryStore.tags,
      package_presets: memoryStore.packages,
    });
  } catch (err: any) {
    return c.json({ success: true, settings: memoryStore.settings, tags: memoryStore.tags, package_presets: memoryStore.packages });
  }
});

settingsApp.put('/', async (c) => {
  try {
    const body = await c.req.json<Record<string, string>>();
    Object.assign(memoryStore.settings, body);
    return c.json({ success: true, message: 'Settings saved successfully.' });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to update settings.' }, 500);
  }
});

settingsApp.post('/tags', async (c) => {
  try {
    const body = await c.req.json<{ id?: number; name: string; color?: string; description?: string }>();
    if (body.id) {
      const found = memoryStore.tags.find((t) => t.id === body.id);
      if (found) Object.assign(found, body);
    } else {
      memoryStore.tags.push({ id: memoryStore.tags.length + 1, name: body.name, color: body.color || '#3b82f6', description: body.description || '' });
    }
    return c.json({ success: true, message: 'Tag saved.' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

settingsApp.delete('/tags/:id', async (c) => {
  try {
    const tagId = parseInt(c.req.param('id'), 10);
    memoryStore.tags = memoryStore.tags.filter((t) => t.id !== tagId);
    return c.json({ success: true, message: 'Tag deleted.' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

settingsApp.get('/export', async (c) => {
  return c.json({
    success: true,
    exported_at: new Date().toISOString(),
    data: {
      customers: memoryStore.customers,
      esims: memoryStore.esims,
      packages: memoryStore.packages,
      providers: memoryStore.providers,
      transactions: memoryStore.transactions,
      support: memoryStore.support_tickets,
      tasks: memoryStore.tasks,
      notes: memoryStore.notes,
      staff: memoryStore.users,
    },
  });
});

export default settingsApp;
