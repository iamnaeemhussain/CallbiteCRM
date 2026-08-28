import { Hono } from 'hono';
import { Env } from '../types';
import { generateId } from '../db';
import { ensureReferralRequestTables } from '../referral-tables';

const publicReferralsApp = new Hono<{ Bindings: Env }>();

function cleanPhone(value?: string | null): string {
  return String(value || '').replace(/[^\d+]/g, '').trim();
}

async function readBody(c: any): Promise<any> {
  const contentType = (c.req.header('content-type') || '').toLowerCase();
  try {
    if (contentType.includes('application/json')) {
      return await c.req.json();
    }
    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const form = await c.req.parseBody();
      return form || {};
    }
    return await c.req.json().catch(async () => {
      const form = await c.req.parseBody().catch(() => ({}));
      return form || {};
    });
  } catch {
    return {};
  }
}

publicReferralsApp.get('/', (c) => {
  return c.json({
    success: true,
    service: 'pak-tel-referral-ingest',
    methods: ['POST', 'OPTIONS'],
    auth: false,
  });
});

publicReferralsApp.post('/', async (c) => {
  try {
    const db = c.env.DB;
    if (!db) {
      return c.json({ success: false, error: 'Database binding missing.' }, 500);
    }
    await ensureReferralRequestTables(db);

    const body = await readBody(c);

    if (body.website) {
      return c.json({ success: true, message: 'Referral received.' });
    }

    const permission = body.permission === true || body.permission === 'true' || body.permission === 'on' || body.permission === '1';
    if (body.permission !== undefined && body.permission !== null && body.permission !== '' && !permission) {
      return c.json({ success: false, error: 'Permission to share contact details is required.' }, 400);
    }

    const friendName = String(body.friend_name || body.friendName || body.name || '').trim();
    const friendWhatsapp = cleanPhone(body.friend_whatsapp || body.friendWhatsapp || body.whatsapp || body.phone);
    if (!friendName) return c.json({ success: false, error: 'Friend’s name is required.' }, 400);
    if (friendWhatsapp.length < 8) return c.json({ success: false, error: 'Friend’s WhatsApp number is required.' }, 400);

    const now = new Date().toISOString();
    const id = await generateId(db, 'referral_requests', 'REF', 1001);
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || null;

    await db
      .prepare(
        `INSERT INTO referral_requests (id, friend_name, friend_whatsapp, friend_phone_model, notes, referrer_name, referrer_phone, referrer_email, source, status, converted_customer_id, ip_address, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', NULL, ?, ?, ?)`
      )
      .bind(
        id,
        friendName,
        friendWhatsapp,
        String(body.friend_phone_model || body.friendPhoneModel || body.phone_model || '').trim() || null,
        String(body.notes || body.message || '').trim() || null,
        String(body.referrer_name || body.referrerName || '').trim() || null,
        body.referrer_phone || body.referrerPhone ? cleanPhone(body.referrer_phone || body.referrerPhone) : null,
        String(body.referrer_email || body.referrerEmail || '').trim() || null,
        'pak-tel.com/refer-a-friend',
        ip,
        now,
        now
      )
      .run();

    return c.json({
      success: true,
      message: 'Referral received. The Pak-Tel team will follow up.',
      request_id: id,
    });
  } catch (err: any) {
    console.error('Public referral ingest error:', err);
    return c.json({ success: false, error: err.message || 'Failed to save referral.' }, 500);
  }
});

export default publicReferralsApp;
