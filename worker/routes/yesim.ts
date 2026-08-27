import { Hono } from 'hono';
import { Env, StaffUser } from '../types';
import { authMiddleware, adminOnlyMiddleware } from '../auth';
import { logAudit, generateId } from '../db';

const YESIM_DEFAULT_BASE = 'https://partners-api.yesim.biz';
const TOKEN_SETTING_KEY = 'yesim_api_token';

const yesimApp = new Hono<{ Bindings: Env; Variables: { user: StaffUser } }>();

yesimApp.use('*', authMiddleware);

function maskToken(token?: string | null): string {
  if (!token) return '';
  if (token.length <= 10) return '••••••••';
  return `${token.slice(0, 4)}••••${token.slice(-6)}`;
}

function sanitizeParams(params: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(params || {})) {
    if (k === 'token' || k === 'api_token') continue;
    if (v === undefined || v === null || v === '') continue;
    out[k] = v;
  }
  return out;
}

async function ensureYesimTables(db: D1Database) {
  // D1 db.exec() splits on newlines, so a multi-line CREATE TABLE becomes
  // "CREATE TABLE IF NOT EXISTS yesim_api_logs (" and fails with incomplete input.
  // Use prepare().run() (one full statement each) instead.
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS yesim_api_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id TEXT, staff_name TEXT, action TEXT NOT NULL, endpoint TEXT NOT NULL, request_params_json TEXT, response_json TEXT, status_code INTEGER, success INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS yesim_profiles (id INTEGER PRIMARY KEY AUTOINCREMENT, yesim_id TEXT, iccid TEXT UNIQUE, yesim_user_id TEXT, email TEXT, qrcode TEXT, imsi TEXT, msisdn TEXT, status_qr TEXT, active_plan_id TEXT, plan_activated_at TEXT, plan_expired_at TEXT, data_left_mb REAL, data_package_mb REAL, data_used_mb REAL, ios_tap_link TEXT, raw_json TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`
    )
    .run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_yesim_logs_created ON yesim_api_logs(created_at)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_yesim_profiles_iccid ON yesim_profiles(iccid)`).run();
}

async function getSetting(db: D1Database, key: string): Promise<string> {
  const row = await db.prepare(`SELECT value FROM settings WHERE key = ?`).bind(key).first<{ value: string }>();
  return row?.value || '';
}

async function upsertSetting(db: D1Database, key: string, value: string, description: string) {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO settings (key, value, description, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, description = excluded.description, updated_at = excluded.updated_at`
    )
    .bind(key, value, description, now)
    .run();
}

async function getYesimToken(db: D1Database): Promise<string | null> {
  const token = (await getSetting(db, TOKEN_SETTING_KEY)).trim();
  return token || null;
}

async function getYesimBase(db: D1Database): Promise<string> {
  const base = (await getSetting(db, 'yesim_api_base_url')).trim();
  return base || YESIM_DEFAULT_BASE;
}

function truncateJson(value: any, max = 12000): string {
  try {
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    if (str.length <= max) return str;
    return str.slice(0, max) + '…[truncated]';
  } catch {
    return '';
  }
}

async function writeLog(
  db: D1Database,
  params: {
    staff_id?: string | null;
    staff_name?: string;
    action: string;
    endpoint: string;
    request?: any;
    response?: any;
    status_code?: number;
    success: boolean;
  }
) {
  try {
    await db
      .prepare(
        `INSERT INTO yesim_api_logs (staff_id, staff_name, action, endpoint, request_params_json, response_json, status_code, success, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        params.staff_id || null,
        params.staff_name || null,
        params.action,
        params.endpoint,
        params.request ? truncateJson(sanitizeParams(params.request)) : null,
        params.response !== undefined ? truncateJson(params.response) : null,
        params.status_code ?? null,
        params.success ? 1 : 0,
        new Date().toISOString()
      )
      .run();
  } catch (err) {
    console.error('yesim log write failed:', err);
  }
}

function extractProfile(payload: any): any | null {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.iccid) return payload;
  if (payload.esim && payload.esim.iccid) return payload.esim;
  if (Array.isArray(payload.esims) && payload.esims[0]?.iccid) return payload.esims[0];
  if (Array.isArray(payload) && payload[0]?.iccid) return payload[0];
  return null;
}

async function upsertProfile(db: D1Database, payload: any, email?: string) {
  const profile = extractProfile(payload);
  if (!profile?.iccid) return;

  const now = new Date().toISOString();
  const existing = await db
    .prepare(`SELECT id FROM yesim_profiles WHERE iccid = ?`)
    .bind(String(profile.iccid))
    .first<{ id: number }>();

  const fields = {
    yesim_id: profile.id != null ? String(profile.id) : null,
    iccid: String(profile.iccid),
    yesim_user_id: profile.user_id != null ? String(profile.user_id) : null,
    email: email || null,
    qrcode: profile.qrcode || null,
    imsi: profile.imsi || null,
    msisdn: profile.msisdn != null ? String(profile.msisdn) : null,
    status_qr: profile.status_qr || null,
    active_plan_id: profile.active_plan_id != null ? String(profile.active_plan_id) : null,
    plan_activated_at: profile.plan_activated_at || null,
    plan_expired_at: profile.plan_expired_at || null,
    data_left_mb: profile.data_left_mb != null ? Number(profile.data_left_mb) : null,
    data_package_mb: profile.data_package_mb != null ? Number(profile.data_package_mb) : null,
    data_used_mb: profile.data_used_mb != null ? Number(profile.data_used_mb) : null,
    ios_tap_link: profile.ios_tap_link || null,
    raw_json: truncateJson(profile, 20000),
  };

  if (existing) {
    await db
      .prepare(
        `UPDATE yesim_profiles SET
          yesim_id = ?, yesim_user_id = ?, email = COALESCE(?, email), qrcode = ?, imsi = ?, msisdn = ?,
          status_qr = ?, active_plan_id = ?, plan_activated_at = ?, plan_expired_at = ?,
          data_left_mb = ?, data_package_mb = ?, data_used_mb = ?, ios_tap_link = ?, raw_json = ?, updated_at = ?
         WHERE iccid = ?`
      )
      .bind(
        fields.yesim_id,
        fields.yesim_user_id,
        fields.email,
        fields.qrcode,
        fields.imsi,
        fields.msisdn,
        fields.status_qr,
        fields.active_plan_id,
        fields.plan_activated_at,
        fields.plan_expired_at,
        fields.data_left_mb,
        fields.data_package_mb,
        fields.data_used_mb,
        fields.ios_tap_link,
        fields.raw_json,
        now,
        fields.iccid
      )
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO yesim_profiles (
          yesim_id, iccid, yesim_user_id, email, qrcode, imsi, msisdn, status_qr,
          active_plan_id, plan_activated_at, plan_expired_at, data_left_mb, data_package_mb,
          data_used_mb, ios_tap_link, raw_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        fields.yesim_id,
        fields.iccid,
        fields.yesim_user_id,
        fields.email,
        fields.qrcode,
        fields.imsi,
        fields.msisdn,
        fields.status_qr,
        fields.active_plan_id,
        fields.plan_activated_at,
        fields.plan_expired_at,
        fields.data_left_mb,
        fields.data_package_mb,
        fields.data_used_mb,
        fields.ios_tap_link,
        fields.raw_json,
        now,
        now
      )
      .run();
  }
}

async function callYesim(
  db: D1Database,
  currentUser: StaffUser,
  opts: {
    action: string;
    method: 'GET' | 'POST';
    path: string;
    params?: Record<string, any>;
    body?: any;
  }
): Promise<{ ok: boolean; status: number; data: any; error?: string }> {
  const token = await getYesimToken(db);
  if (!token) {
    return {
      ok: false,
      status: 400,
      data: null,
      error: 'Yesim API token is not saved. Open eSIM API Box and paste your token from core.yesim.biz.',
    };
  }

  const base = await getYesimBase(db);
  const query = new URLSearchParams();
  query.set('token', token);

  const safeParams = sanitizeParams(opts.params || {});
  for (const [k, v] of Object.entries(safeParams)) {
    if (Array.isArray(v)) query.set(k, v.join(','));
    else query.set(k, String(v));
  }

  const url = `${base.replace(/\/$/, '')}${opts.path}?${query.toString()}`;
  let status = 0;
  let data: any = null;

  try {
    const init: RequestInit = { method: opts.method };
    if (opts.method === 'POST') {
      if (opts.body !== undefined) {
        init.headers = { 'Content-Type': 'application/json' };
        init.body = JSON.stringify(opts.body);
      } else {
        init.body = '';
      }
    }

    const res = await fetch(url, init);
    status = res.status;
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    const looksError =
      !res.ok ||
      (data && typeof data === 'object' && !Array.isArray(data) && (data.error || data.status === 'error' || data.success === false));

    await writeLog(db, {
      staff_id: currentUser.id,
      staff_name: currentUser.name,
      action: opts.action,
      endpoint: opts.path,
      request: safeParams,
      response: data,
      status_code: status,
      success: !looksError,
    });

    if (looksError) {
      const errMsg =
        (data && typeof data === 'object' && (data.error || data.description || data.message)) ||
        `Yesim API request failed (${status})`;
      return { ok: false, status: status || 502, data, error: String(errMsg) };
    }

    return { ok: true, status, data };
  } catch (err: any) {
    const causeMsg = err?.cause?.message || err?.cause?.code || '';
    const raw = [err?.message, causeMsg].filter(Boolean).join(' — ');
    const isTls =
      /fetch failed|ECONNRESET|SSL|TLS|socket disconnected|ECONNREFUSED|ENOTFOUND|cert/i.test(raw);
    const error = isTls
      ? `Cannot reach Yesim Partner API (${base}). TLS handshake was reset before the connection completed. Live Yesim calls work from the deployed Cloudflare Worker (crm.callbite.workers.dev), not from this local preview. Token save in D1 still works here.`
      : raw || 'Failed to reach Yesim Partner API.';

    await writeLog(db, {
      staff_id: currentUser.id,
      staff_name: currentUser.name,
      action: opts.action,
      endpoint: opts.path,
      request: safeParams,
      response: { error, raw },
      status_code: status || 0,
      success: false,
    });
    return { ok: false, status: 502, data: null, error };
  }
}

function jsonFail(c: any, result: { error?: string; data?: any; status: number }) {
  // Always 400 so a Yesim 401 never clears the CRM staff session.
  return c.json({ success: false, error: result.error || 'Yesim API error.', data: result.data }, 400);
}

yesimApp.get('/config', async (c) => {
  try {
    const db = c.env.DB;
    await ensureYesimTables(db);
    const token = await getYesimToken(db);
    const baseUrl = await getYesimBase(db);
    const eurToPkr = (await getSetting(db, 'yesim_eur_to_pkr')) || '310';
    const notificationUrl = await getSetting(db, 'yesim_notification_url');

    const logCount = await db.prepare(`SELECT COUNT(*) AS n FROM yesim_api_logs`).first<{ n: number }>();
    const profileCount = await db.prepare(`SELECT COUNT(*) AS n FROM yesim_profiles`).first<{ n: number }>();

    return c.json({
      success: true,
      configured: Boolean(token),
      token_masked: maskToken(token),
      base_url: baseUrl,
      eur_to_pkr: Number(eurToPkr) || 310,
      notification_url: notificationUrl || '',
      docs_url: 'https://documenter.getpostman.com/view/19324374/2sA3kbgy28',
      token_portal_url: 'https://core.yesim.biz/index.php?act=api_token',
      log_count: logCount?.n || 0,
      profile_count: profileCount?.n || 0,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || 'Failed to load Yesim config.' }, 500);
  }
});

yesimApp.put('/token', adminOnlyMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');
    await ensureYesimTables(db);
    const body = await c.req.json<{ token?: string }>();
    const token = (body.token || '').trim();

    if (!token || token.length < 8) {
      return c.json({ success: false, error: 'Paste a valid Yesim API token (minimum 8 characters).' }, 400);
    }

    await upsertSetting(db, TOKEN_SETTING_KEY, token, 'Yesim Partner API access token from core.yesim.biz');

    const clientIp = c.req.header('cf-connecting-ip') || '127.0.0.1';
    await logAudit(db, {
      staff_id: currentUser.id,
      staff_name: currentUser.name,
      action: 'UPDATE',
      record_type: 'YESIM_API',
      record_id: 'TOKEN',
      change_summary: `${currentUser.name} saved Yesim Partner API token`,
      ip_address: clientIp,
    });

    return c.json({
      success: true,
      message: 'Yesim API token saved to D1 settings (yesim_api_token).',
      token_masked: maskToken(token),
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || 'Failed to save token.' }, 500);
  }
});

yesimApp.delete('/token', adminOnlyMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');
    await upsertSetting(db, TOKEN_SETTING_KEY, '', 'Yesim Partner API access token from core.yesim.biz');
    await logAudit(db, {
      staff_id: currentUser.id,
      staff_name: currentUser.name,
      action: 'DELETE',
      record_type: 'YESIM_API',
      record_id: 'TOKEN',
      change_summary: `${currentUser.name} cleared Yesim Partner API token`,
      ip_address: c.req.header('cf-connecting-ip') || '127.0.0.1',
    });
    return c.json({ success: true, message: 'Yesim API token removed.' });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to clear token.' }, 500);
  }
});

yesimApp.put('/settings', adminOnlyMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const body = await c.req.json<{ eur_to_pkr?: number | string; notification_url?: string; base_url?: string }>();

    if (body.eur_to_pkr !== undefined) {
      const rate = Number(body.eur_to_pkr);
      if (!rate || rate <= 0) {
        return c.json({ success: false, error: 'EUR to PKR rate must be a positive number.' }, 400);
      }
      await upsertSetting(db, 'yesim_eur_to_pkr', String(rate), 'EUR to PKR conversion rate for importing Yesim wholesale plans');
    }
    if (body.notification_url !== undefined) {
      await upsertSetting(db, 'yesim_notification_url', String(body.notification_url).trim(), 'Webhook URL registered with Yesim');
    }
    if (body.base_url !== undefined) {
      const base = String(body.base_url).trim() || YESIM_DEFAULT_BASE;
      await upsertSetting(db, 'yesim_api_base_url', base, 'Yesim Partner API base URL');
    }

    return c.json({ success: true, message: 'Yesim settings saved.' });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to save Yesim settings.' }, 500);
  }
});

yesimApp.get('/balance', async (c) => {
  const db = c.env.DB;
  await ensureYesimTables(db);
  const result = await callYesim(db, c.get('user'), { action: 'BALANCE', method: 'GET', path: '/balance' });
  if (!result.ok) return jsonFail(c, result);
  return c.json({ success: true, data: result.data });
});

yesimApp.get('/plans', async (c) => {
  const db = c.env.DB;
  await ensureYesimTables(db);
  const { plan_id, filter, search } = c.req.query();
  const result = await callYesim(db, c.get('user'), {
    action: 'PLANS',
    method: 'GET',
    path: '/plans',
    params: { plan_id, filter },
  });
  if (!result.ok) return jsonFail(c, result);

  let plans = Array.isArray(result.data) ? result.data : result.data?.plans || result.data?.data || [];
  if (!Array.isArray(plans)) plans = [];

  const q = (search || '').trim().toLowerCase();
  if (q) {
    plans = plans.filter((p: any) => {
      const hay = [p.name, p.countries_included, p.countryIso2, p.iso3, p.operators, p.plan_type, p.id, p.old_id]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }

  return c.json({ success: true, count: plans.length, plans });
});

yesimApp.post('/new-user', async (c) => {
  const db = c.env.DB;
  await ensureYesimTables(db);
  const body = await c.req.json<{ email: string }>();
  const email = (body.email || '').trim();
  if (!email) return c.json({ success: false, error: 'Email is required.' }, 400);

  const result = await callYesim(db, c.get('user'), {
    action: 'NEW_USER',
    method: 'POST',
    path: '/new_user',
    params: { email },
  });
  if (!result.ok) return jsonFail(c, result);
  return c.json({ success: true, data: result.data });
});

yesimApp.post('/new-esim', async (c) => {
  const db = c.env.DB;
  await ensureYesimTables(db);
  const body = await c.req.json<{ user_id?: string }>().catch(() => ({} as { user_id?: string }));
  const result = await callYesim(db, c.get('user'), {
    action: 'NEW_ESIM',
    method: 'GET',
    path: '/new_esim',
    params: { user_id: body.user_id },
  });
  if (!result.ok) return jsonFail(c, result);
  await upsertProfile(db, result.data);
  return c.json({ success: true, data: result.data });
});

yesimApp.post('/add-plan', async (c) => {
  const db = c.env.DB;
  await ensureYesimTables(db);
  const body = await c.req.json<{ iccid: string; plan_id: string }>();
  if (!body.iccid?.trim() || !body.plan_id?.toString().trim()) {
    return c.json({ success: false, error: 'ICCID and Plan ID are required.' }, 400);
  }
  const result = await callYesim(db, c.get('user'), {
    action: 'ADD_PLAN',
    method: 'POST',
    path: '/add_plan_iccid',
    params: { iccid: body.iccid.trim(), plan_id: String(body.plan_id).trim() },
  });
  if (!result.ok) return jsonFail(c, result);
  return c.json({ success: true, data: result.data });
});

yesimApp.post('/cancel-plan', async (c) => {
  const db = c.env.DB;
  await ensureYesimTables(db);
  const body = await c.req.json<{ iccid: string; plan_id?: string }>();
  if (!body.iccid?.trim()) return c.json({ success: false, error: 'ICCID is required.' }, 400);
  const result = await callYesim(db, c.get('user'), {
    action: 'CANCEL_PLAN',
    method: 'POST',
    path: '/cancel_plan',
    params: { iccid: body.iccid.trim(), plan_id: body.plan_id },
  });
  if (!result.ok) return jsonFail(c, result);
  return c.json({ success: true, data: result.data });
});

yesimApp.get('/sim-info', async (c) => {
  const db = c.env.DB;
  await ensureYesimTables(db);
  const iccid = (c.req.query('iccid') || '').trim();
  if (!iccid) return c.json({ success: false, error: 'ICCID is required.' }, 400);
  const result = await callYesim(db, c.get('user'), {
    action: 'SIM_INFO',
    method: 'GET',
    path: '/sim_info',
    params: { iccid },
  });
  if (!result.ok) return jsonFail(c, result);
  await upsertProfile(db, result.data);
  return c.json({ success: true, data: result.data });
});

yesimApp.get('/user', async (c) => {
  const db = c.env.DB;
  await ensureYesimTables(db);
  const user_id = (c.req.query('user_id') || '').trim();
  if (!user_id) return c.json({ success: false, error: 'Yesim user_id is required.' }, 400);
  const result = await callYesim(db, c.get('user'), {
    action: 'USER',
    method: 'GET',
    path: '/user',
    params: { user_id },
  });
  if (!result.ok) return jsonFail(c, result);
  if (result.data?.esims && Array.isArray(result.data.esims)) {
    for (const esim of result.data.esims) {
      await upsertProfile(db, esim, result.data.email);
    }
  }
  return c.json({ success: true, data: result.data });
});

yesimApp.get('/orders', async (c) => {
  const db = c.env.DB;
  await ensureYesimTables(db);
  const search = c.req.query('search') || '';
  const result = await callYesim(db, c.get('user'), {
    action: 'ORDERS',
    method: 'GET',
    path: '/orders',
    params: { search },
  });
  if (!result.ok) return jsonFail(c, result);
  const orders = Array.isArray(result.data) ? result.data : result.data?.orders || result.data?.data || result.data;
  return c.json({ success: true, data: orders });
});

yesimApp.post('/change-esim', async (c) => {
  const db = c.env.DB;
  await ensureYesimTables(db);
  const body = await c.req.json<{ user_id: string }>();
  if (!body.user_id?.trim()) return c.json({ success: false, error: 'Yesim user_id is required.' }, 400);
  const result = await callYesim(db, c.get('user'), {
    action: 'CHANGE_ESIM',
    method: 'POST',
    path: '/change_esim',
    params: { user_id: body.user_id.trim() },
  });
  if (!result.ok) return jsonFail(c, result);
  await upsertProfile(db, result.data);
  return c.json({ success: true, data: result.data });
});

yesimApp.post('/notification-url', async (c) => {
  const db = c.env.DB;
  await ensureYesimTables(db);
  const body = await c.req.json<{ url: string }>();
  const url = (body.url || '').trim();
  if (!url) return c.json({ success: false, error: 'Notification URL is required.' }, 400);
  const result = await callYesim(db, c.get('user'), {
    action: 'SET_NOTIFICATION_URL',
    method: 'POST',
    path: '/set_notification_url',
    params: { url },
  });
  if (!result.ok) return jsonFail(c, result);
  await upsertSetting(db, 'yesim_notification_url', url, 'Webhook URL registered with Yesim');
  return c.json({ success: true, data: result.data });
});

yesimApp.get('/supported-devices', async (c) => {
  const db = c.env.DB;
  await ensureYesimTables(db);
  const result = await callYesim(db, c.get('user'), {
    action: 'SUPPORTED_DEVICES',
    method: 'GET',
    path: '/supported_devices',
  });
  if (!result.ok) return jsonFail(c, result);
  return c.json({ success: true, data: result.data });
});

yesimApp.post('/issue-esim', async (c) => {
  const db = c.env.DB;
  await ensureYesimTables(db);
  const body = await c.req.json<{ count?: number; user_id?: string; plan_id?: string }>();
  const count = Number(body.count || 1);
  if (!count || count < 1) return c.json({ success: false, error: 'Count must be at least 1.' }, 400);
  const result = await callYesim(db, c.get('user'), {
    action: 'ISSUE_ESIM',
    method: 'POST',
    path: '/issue_esim',
    params: { count, user_id: body.user_id, plan_id: body.plan_id },
  });
  if (!result.ok) return jsonFail(c, result);

  const list = Array.isArray(result.data) ? result.data : result.data?.esims || [result.data];
  if (Array.isArray(list)) {
    for (const item of list) await upsertProfile(db, item);
  }
  return c.json({ success: true, data: result.data });
});

yesimApp.post('/bulk-sim-info', async (c) => {
  const db = c.env.DB;
  await ensureYesimTables(db);
  const body = await c.req.json<{ iccids: string[] | string }>();
  let list: string[] = [];
  if (Array.isArray(body.iccids)) list = body.iccids.map((x) => String(x).trim()).filter(Boolean);
  else if (typeof body.iccids === 'string') {
    list = body.iccids
      .split(/[\s,;\n]+/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  if (list.length === 0) return c.json({ success: false, error: 'Provide at least one ICCID.' }, 400);

  const result = await callYesim(db, c.get('user'), {
    action: 'BULK_SIM_INFO',
    method: 'POST',
    path: '/bulk_sim_info',
    params: { iccids: list.join(',') },
    body: { iccids: list },
  });
  if (!result.ok) return jsonFail(c, result);
  const items = Array.isArray(result.data) ? result.data : result.data?.esims || result.data?.data || [];
  if (Array.isArray(items)) {
    for (const item of items) await upsertProfile(db, item);
  }
  return c.json({ success: true, data: result.data });
});

yesimApp.get('/allowed-operators', async (c) => {
  const db = c.env.DB;
  await ensureYesimTables(db);
  const { country, iccid } = c.req.query();
  const result = await callYesim(db, c.get('user'), {
    action: 'ALLOWED_OPERATORS',
    method: 'GET',
    path: '/allowed_operators',
    params: { country, iccid },
  });
  if (!result.ok) return jsonFail(c, result);
  return c.json({ success: true, data: result.data });
});

yesimApp.post('/import-plan', async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');
    const body = await c.req.json<{
      name: string;
      countries_included?: string;
      data?: string | number;
      days?: string | number;
      price?: string | number;
      currency?: string;
      apn?: string;
      operators?: string;
      old_id?: string;
      id?: string;
      selling_price?: number;
      cost_price?: number;
    }>();

    if (!body.name?.trim()) return c.json({ success: false, error: 'Plan name is required.' }, 400);

    const eurToPkr = Number((await getSetting(db, 'yesim_eur_to_pkr')) || 310) || 310;
    const wholesale = Number(body.price || 0);
    const costPrice = body.cost_price != null ? Number(body.cost_price) : Math.round(wholesale * eurToPkr);
    const sellPrice = body.selling_price != null ? Number(body.selling_price) : Math.round(costPrice * 1.4);
    const profit = sellPrice - costPrice;
    const now = new Date().toISOString();
    const pkgId = await generateId(db, 'packages', 'PKG', 101);
    const days = body.days != null ? `${body.days} Days` : '30 Days';
    const dataAllowance = body.data != null ? `${body.data}GB` : 'Data';
    const region = (body.countries_included || 'Global').toString();
    const yesimRef = body.old_id || body.id || '';

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
        region,
        body.name.trim(),
        dataAllowance,
        days,
        'Yesim',
        null,
        sellPrice,
        costPrice,
        profit,
        [body.apn ? `APN: ${body.apn}` : '', body.operators || ''].filter(Boolean).join(' • ') || null,
        'Active',
        `Imported from Yesim Partner API${yesimRef ? ` (plan ${yesimRef})` : ''}. Wholesale ${body.currency || 'EUR'} ${wholesale}.`,
        now,
        now
      )
      .run();

    await logAudit(db, {
      staff_id: currentUser.id,
      staff_name: currentUser.name,
      action: 'CREATE',
      record_type: 'PACKAGE',
      record_id: pkgId,
      new_value: { name: body.name, cost_price: costPrice, selling_price: sellPrice, yesim_plan: yesimRef },
      change_summary: `${currentUser.name} imported Yesim plan ${body.name.trim()} into packages catalog`,
      ip_address: c.req.header('cf-connecting-ip') || '127.0.0.1',
    });

    return c.json({
      success: true,
      message: `Plan imported to eSIM Packages & Bundles as ${pkgId}.`,
      package_id: pkgId,
      cost_price: costPrice,
      selling_price: sellPrice,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || 'Failed to import plan.' }, 500);
  }
});

yesimApp.get('/logs', async (c) => {
  try {
    const db = c.env.DB;
    await ensureYesimTables(db);
    const limit = Math.min(Number(c.req.query('limit') || 50), 200);
    const rows = await db
      .prepare(
        `SELECT id, staff_id, staff_name, action, endpoint, request_params_json, response_json, status_code, success, created_at
         FROM yesim_api_logs ORDER BY created_at DESC LIMIT ?`
      )
      .bind(limit)
      .all<any>();
    return c.json({ success: true, logs: rows.results || [] });
  } catch (err: any) {
    return c.json({ success: true, logs: [] });
  }
});

yesimApp.get('/profiles', async (c) => {
  try {
    const db = c.env.DB;
    await ensureYesimTables(db);
    const search = (c.req.query('search') || '').trim();
    let query = `SELECT * FROM yesim_profiles`;
    const params: any[] = [];
    if (search) {
      query += ` WHERE iccid LIKE ? OR yesim_user_id LIKE ? OR email LIKE ? OR yesim_id LIKE ?`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    query += ` ORDER BY updated_at DESC LIMIT 100`;
    const rows = await db.prepare(query).bind(...params).all<any>();
    return c.json({ success: true, profiles: rows.results || [] });
  } catch (err: any) {
    return c.json({ success: true, profiles: [] });
  }
});

export default yesimApp;
