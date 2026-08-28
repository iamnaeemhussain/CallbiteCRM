interface Env {
  DB: D1Database;
}

const ALLOWED_ORIGINS = new Set([
  'https://pak-tel.com',
  'https://www.pak-tel.com',
  'http://pak-tel.com',
  'http://www.pak-tel.com',
]);

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('Origin') || '';
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://pak-tel.com';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(request: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function cleanPhone(value?: string | null): string {
  return String(value || '').replace(/[^\d+]/g, '').trim();
}

async function ensureTable(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS referral_requests (id TEXT PRIMARY KEY, friend_name TEXT NOT NULL, friend_whatsapp TEXT NOT NULL, friend_phone_model TEXT, notes TEXT, referrer_name TEXT, referrer_phone TEXT, referrer_email TEXT, source TEXT NOT NULL DEFAULT 'pak-tel.com', status TEXT NOT NULL DEFAULT 'New', converted_customer_id TEXT, ip_address TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`
    )
    .run();
}

async function nextId(db: D1Database): Promise<string> {
  const row = await db
    .prepare(`SELECT id FROM referral_requests WHERE id LIKE 'REF-%' ORDER BY id DESC LIMIT 1`)
    .first<{ id: string }>();
  if (!row?.id) return 'REF-1001';
  const num = parseInt(String(row.id).replace(/^REF-/, ''), 10);
  if (!Number.isFinite(num)) return `REF-${Date.now().toString().slice(-6)}`;
  return `REF-${num + 1}`;
}

export const onRequestOptions: PagesFunction<Env> = async ({ request }) => {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
};

export const onRequestGet: PagesFunction<Env> = async ({ request }) => {
  return json(request, {
    success: true,
    service: 'pak-tel-referral-ingest',
    auth: false,
    methods: ['POST', 'OPTIONS', 'GET'],
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  try {
    if (!env?.DB) {
      return json(request, { success: false, error: 'D1 binding DB is missing on this Pages project.' }, 500);
    }

    await ensureTable(env.DB);

    const contentType = (request.headers.get('content-type') || '').toLowerCase();
    let body: any = {};
    if (contentType.includes('application/json')) {
      body = await request.json().catch(() => ({}));
    } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      body = Object.fromEntries(form.entries());
    } else {
      body = await request.json().catch(() => ({}));
    }

    if (body.website) {
      return json(request, { success: true, message: 'Referral received.' });
    }

    const friendName = String(body.friend_name || body.friendName || body.name || '').trim();
    const friendWhatsapp = cleanPhone(body.friend_whatsapp || body.friendWhatsapp || body.whatsapp || body.phone);
    if (!friendName) return json(request, { success: false, error: 'Friend’s name is required.' }, 400);
    if (friendWhatsapp.length < 8) {
      return json(request, { success: false, error: 'Friend’s WhatsApp number is required.' }, 400);
    }

    const now = new Date().toISOString();
    const id = await nextId(env.DB);
    const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || null;

    await env.DB
      .prepare(
        `INSERT INTO referral_requests (id, friend_name, friend_whatsapp, friend_phone_model, notes, referrer_name, referrer_phone, referrer_email, source, status, converted_customer_id, ip_address, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', NULL, ?, ?, ?)`
      )
      .bind(
        id,
        friendName,
        friendWhatsapp,
        String(body.friend_phone_model || body.phone_model || '').trim() || null,
        String(body.notes || body.message || '').trim() || null,
        String(body.referrer_name || '').trim() || null,
        body.referrer_phone ? cleanPhone(body.referrer_phone) : null,
        String(body.referrer_email || '').trim() || null,
        'pak-tel.com/refer-a-friend',
        ip,
        now,
        now
      )
      .run();

    return json(request, {
      success: true,
      message: 'Referral received. The Pak-Tel team will follow up.',
      request_id: id,
    });
  } catch (err: any) {
    return json(request, { success: false, error: err?.message || 'Failed to save referral.' }, 500);
  }
};
