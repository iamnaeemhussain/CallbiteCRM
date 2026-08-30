import { Hono } from 'hono';
import { Env, StaffUser } from '../types';
import { authMiddleware } from '../auth';
import { generateId, logAudit } from '../db';
import { ensureReferralRequestTables } from '../referral-tables';

const referralsApp = new Hono<{ Bindings: Env; Variables: { user: StaffUser } }>();

referralsApp.use('*', authMiddleware);

function normalizeHeader(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\n') {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else if (c !== '\r') {
      cur += c;
    }
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => String(cell).trim() !== ''));
}

function sheetToCsvUrl(input: string): string {
  const raw = input.trim();
  if (raw.includes('/export?') || raw.includes('tqx=out:csv') || raw.endsWith('.csv')) return raw;
  const idMatch = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const gidMatch = raw.match(/[?&#]gid=([0-9]+)/);
  if (idMatch) {
    const gid = gidMatch ? gidMatch[1] : '0';
    return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/gviz/tq?tqx=out:csv&gid=${gid}`;
  }
  return raw;
}

function cleanPhone(value?: string | null): string {
  return String(value || '').replace(/[^\d+]/g, '').trim();
}

async function getSheetUrl(db: D1Database): Promise<string> {
  const row = await db.prepare(`SELECT value FROM settings WHERE key = ?`).bind('referral_sheet_csv_url').first<{ value: string }>();
  return row?.value || 'https://docs.google.com/spreadsheets/d/1vCRClg8BR3K_yWH3Y-TUiiqsYwsqtOCjaBg_lm1ZKRg/edit?gid=0#gid=0';
}

async function saveSheetUrl(db: D1Database, url: string) {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO settings (key, value, description, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .bind('referral_sheet_csv_url', url, 'Google Sheet CSV/export URL for referral requests', now)
    .run();
}

referralsApp.get('/sheet', async (c) => {
  const url = await getSheetUrl(c.env.DB);
  return c.json({ success: true, sheet_url: url });
});

referralsApp.put('/sheet', async (c) => {
  const body = await c.req.json<{ sheet_url?: string }>();
  const url = String(body.sheet_url || '').trim();
  await saveSheetUrl(c.env.DB, url);
  return c.json({ success: true, sheet_url: url, message: 'Google Sheet URL saved.' });
});

referralsApp.post('/requests/sync-sheet', async (c) => {
  try {
    const db = c.env.DB;
    await ensureReferralRequestTables(db);
    const body = await c.req.json<{ sheet_url?: string }>().catch(() => ({} as { sheet_url?: string }));
    let sheetUrl = String(body.sheet_url || '').trim() || (await getSheetUrl(db));
    if (!sheetUrl) {
      return c.json({ success: false, error: 'Paste a Google Sheet URL first (Share → Anyone with the link, then save).' }, 400);
    }
    await saveSheetUrl(db, sheetUrl);
    const csvUrl = sheetToCsvUrl(sheetUrl);

    const res = await fetch(csvUrl, { headers: { Accept: 'text/csv,text/plain,*/*' } });
    if (!res.ok) {
      return c.json(
        {
          success: false,
          error: `Could not read the Google Sheet (${res.status}). Share it as “Anyone with the link can view”, then try again.`,
        },
        400
      );
    }
    const csv = await res.text();
    const rows = parseCsv(csv);
    if (rows.length < 2) {
      return c.json({ success: false, error: 'Sheet has no data rows.' }, 400);
    }

    const headers = rows[0].map(normalizeHeader);
    const idxName = headers.findIndex((h) => h.includes('friend') && h.includes('name'));
    const idxWa = headers.findIndex((h) => h.includes('whatsapp'));
    const idxModel = headers.findIndex((h) => h.includes('phone') && h.includes('model'));
    const idxNotes = headers.findIndex((h) => h.includes('anything else') || h === 'notes');
    if (idxName < 0 || idxWa < 0) {
      return c.json({
        success: false,
        error: `Could not find required columns. Found: ${rows[0].join(' | ')}. Need Friend’s name and Friend’s WhatsApp number.`,
      }, 400);
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const now = new Date().toISOString();

    for (const row of rows.slice(1)) {
      const friendName = String(row[idxName] || '').trim();
      const friendWhatsapp = cleanPhone(row[idxWa]);
      if (!friendName || friendWhatsapp.length < 8) {
        skipped++;
        continue;
      }
      const model = idxModel >= 0 ? String(row[idxModel] || '').trim() || null : null;
      const notes = idxNotes >= 0 ? String(row[idxNotes] || '').trim() || null : null;

      const existing = await db
        .prepare(`SELECT id, status FROM referral_requests WHERE friend_whatsapp = ?`)
        .bind(friendWhatsapp)
        .first<{ id: string; status: string }>();

      if (existing) {
        if (existing.status === 'New') {
          await db
            .prepare(
              `UPDATE referral_requests SET friend_name = ?, friend_phone_model = ?, notes = ?, source = ?, updated_at = ? WHERE id = ?`
            )
            .bind(friendName, model, notes, 'google-sheet', now, existing.id)
            .run();
          updated++;
        } else {
          skipped++;
        }
        continue;
      }

      const id = await generateId(db, 'referral_requests', 'REF', 1001);
      await db
        .prepare(
          `INSERT INTO referral_requests (id, friend_name, friend_whatsapp, friend_phone_model, notes, referrer_name, referrer_phone, referrer_email, source, status, converted_customer_id, ip_address, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, 'google-sheet', 'New', NULL, NULL, ?, ?)`
        )
        .bind(id, friendName, friendWhatsapp, model, notes, now, now)
        .run();
      created++;
    }

    return c.json({
      success: true,
      message: `Synced Google Sheet: ${created} new, ${updated} updated, ${skipped} skipped.`,
      created,
      updated,
      skipped,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || 'Failed to sync Google Sheet.' }, 500);
  }
});

referralsApp.get('/requests', async (c) => {
  try {
    const db = c.env.DB;
    await ensureReferralRequestTables(db);
    try {
      const { syncReferralSheet } = await import('../sheet-sync');
      await syncReferralSheet(db);
    } catch (err) {
      console.error('Auto sheet sync skipped:', err);
    }
    const { status, search } = c.req.query();
    let query = `SELECT * FROM referral_requests WHERE 1=1`;
    const params: any[] = [];
    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }
    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      query += ` AND (friend_name LIKE ? OR friend_whatsapp LIKE ? OR referrer_name LIKE ? OR id LIKE ?)`;
      params.push(s, s, s, s);
    }
    query += ` ORDER BY created_at DESC LIMIT 200`;
    const rows = await db.prepare(query).bind(...params).all<any>();
    const all = rows.results || [];
    const counts = {
      total: all.length,
      new: all.filter((r) => r.status === 'New').length,
      contacted: all.filter((r) => r.status === 'Contacted').length,
      converted: all.filter((r) => r.status === 'Converted').length,
    };
    return c.json({ success: true, requests: all, counts });
  } catch (err: any) {
    console.error('List referral requests error:', err);
    return c.json({ success: true, requests: [], counts: { total: 0, new: 0, contacted: 0, converted: 0 } });
  }
});

referralsApp.put('/requests/:id', async (c) => {
  try {
    const db = c.env.DB;
    await ensureReferralRequestTables(db);
    const id = c.req.param('id');
    const body = await c.req.json<{ status?: string }>();
    const allowed = ['New', 'Contacted', 'Converted', 'Declined'];
    if (!body.status || !allowed.includes(body.status)) {
      return c.json({ success: false, error: 'Valid status is required.' }, 400);
    }
    const existing = await db.prepare(`SELECT * FROM referral_requests WHERE id = ?`).bind(id).first<any>();
    if (!existing) return c.json({ success: false, error: 'Referral request not found.' }, 404);
    await db
      .prepare(`UPDATE referral_requests SET status = ?, updated_at = ? WHERE id = ?`)
      .bind(body.status, new Date().toISOString(), id)
      .run();
    return c.json({ success: true, message: 'Referral request updated.' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || 'Failed to update request.' }, 500);
  }
});

referralsApp.post('/requests/:id/convert', async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');
    await ensureReferralRequestTables(db);
    const id = c.req.param('id');
    const existing = await db.prepare(`SELECT * FROM referral_requests WHERE id = ?`).bind(id).first<any>();
    if (!existing) return c.json({ success: false, error: 'Referral request not found.' }, 404);

    const now = new Date().toISOString();
    await db
      .prepare(`UPDATE referral_requests SET status = 'Converted', updated_at = ? WHERE id = ?`)
      .bind(now, id)
      .run();

    await logAudit(db, {
      staff_id: currentUser.id,
      staff_name: currentUser.name,
      action: 'UPDATE',
      record_type: 'REFERRAL',
      record_id: id,
      change_summary: `${currentUser.name} marked referral request ${id} as converted`,
    });

    return c.json({ success: true, message: 'Referral marked converted.' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || 'Failed to convert referral.' }, 500);
  }
});

referralsApp.get('/', async (c) => {
  return c.json({
    success: true,
    referrers: [],
    referred_customers: [],
    summary: { total_referrals: 0, total_unique_referrers: 0, total_referral_revenue: 0 },
  });
});

export default referralsApp;
