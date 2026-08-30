import { Hono } from 'hono';
import { Env, StaffUser } from '../types';
import { authMiddleware, adminOnlyMiddleware } from '../auth';
import { logAudit } from '../db';

const settingsApp = new Hono<{ Bindings: Env; Variables: { user: StaffUser } }>();

settingsApp.use('*', authMiddleware);

// Get all settings, tags, and package presets
settingsApp.get('/', async (c) => {
  try {
    const db = c.env.DB;

    const settingsRows = await db.prepare(`SELECT key, value, description FROM settings`).all<{ key: string; value: string; description: string }>();
    const settingsMap: Record<string, string> = {};
    const secretKeys = new Set(['yesim_api_token']);
    (settingsRows.results || []).forEach((row) => {
      if (secretKeys.has(row.key)) {
        const val = row.value || '';
        settingsMap[row.key] = val.length > 10 ? `${val.slice(0, 4)}••••${val.slice(-6)}` : val ? '••••••••' : '';
      } else {
        settingsMap[row.key] = row.value;
      }
    });

    const tags = await db.prepare(`SELECT * FROM tags ORDER BY name ASC`).all<any>();

    return c.json({
      success: true,
      settings: settingsMap,
      tags: tags.results || [],
    });
  } catch (err: any) {
    return c.json({ success: true, settings: { company_name: 'Pak-tel.com', currency_symbol: 'Rs.', currency_code: 'PKR', support_phone: '+923001234567' }, tags: [] });
  }
});

// Update settings map
settingsApp.put('/', async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');
    const body = await c.req.json<Record<string, string>>();

    const now = new Date().toISOString();

    for (const [key, val] of Object.entries(body)) {
      if (key && typeof val === 'string') {
        await db
          .prepare(
            `INSERT INTO settings (key, value, description, updated_at)
             VALUES (?, ?, '', ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
          )
          .bind(key, val, now)
          .run();
      }
    }

    const clientIp = c.req.header('cf-connecting-ip') || '127.0.0.1';
    await logAudit(db, {
      staff_id: currentUser.id,
      staff_name: currentUser.name,
      action: 'UPDATE',
      record_type: 'SETTINGS',
      record_id: 'SYSTEM_SETTINGS',
      new_value: body,
      change_summary: `${currentUser.name} updated CRM system settings`,
      ip_address: clientIp,
    });

    return c.json({ success: true, message: 'Settings saved successfully.' });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to update settings.' }, 500);
  }
});

// Tag Management
settingsApp.post('/tags', async (c) => {
  try {
    const db = c.env.DB;
    const body = await c.req.json<{ id?: number; name: string; color?: string; description?: string }>();

    if (!body.name || !body.name.trim()) {
      return c.json({ success: false, error: 'Tag name is required.' }, 400);
    }

    if (body.id) {
      await db
        .prepare(`UPDATE tags SET name = ?, color = ?, description = ? WHERE id = ?`)
        .bind(body.name.trim(), body.color || '#3b82f6', body.description?.trim() || null, body.id)
        .run();
    } else {
      await db
        .prepare(`INSERT OR IGNORE INTO tags (name, color, description) VALUES (?, ?, ?)`)
        .bind(body.name.trim(), body.color || '#3b82f6', body.description?.trim() || null)
        .run();
    }

    return c.json({ success: true, message: 'Tag saved successfully.' });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to save tag.' }, 500);
  }
});

settingsApp.delete('/tags/:id', async (c) => {
  try {
    const db = c.env.DB;
    const tagId = c.req.param('id');
    await db.prepare(`DELETE FROM tags WHERE id = ?`).bind(tagId).run();
    return c.json({ success: true, message: 'Tag deleted successfully.' });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to delete tag.' }, 500);
  }
});

// Full Database Export
settingsApp.get('/export', async (c) => {
  try {
    const db = c.env.DB;

    const esims = await db.prepare(`SELECT * FROM esims WHERE is_deleted = 0`).all();
    const staff = await db.prepare(`SELECT id, name, email, role, phone, status, created_at, last_login_at FROM users`).all();

    return c.json({
      success: true,
      exported_at: new Date().toISOString(),
      data: {
        esims: esims.results || [],
        staff: staff.results || [],
      },
    });
  } catch (err: any) {
    return c.json({ success: false, error: 'Export failed.' }, 500);
  }
});

export default settingsApp;
