import { Hono } from 'hono';
import { Env, StaffUser } from '../types';
import { authMiddleware } from '../auth';
import { generateId, logAudit } from '../db';
import { ensureReferralRequestTables } from '../referral-tables';

const referralsApp = new Hono<{ Bindings: Env; Variables: { user: StaffUser } }>();

referralsApp.use('*', authMiddleware);

referralsApp.get('/requests', async (c) => {
  try {
    const db = c.env.DB;
    await ensureReferralRequestTables(db);
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
    let customerId = existing.converted_customer_id as string | null;
    if (!customerId) {
      const dup = await db
        .prepare(`SELECT id FROM customers WHERE whatsapp_number = ? AND is_deleted = 0`)
        .bind(existing.friend_whatsapp)
        .first<{ id: string }>();
      if (dup) {
        customerId = dup.id;
      } else {
        customerId = await generateId(db, 'customers', 'CUST', 1016);
        await db
          .prepare(
            `INSERT INTO customers (id, full_name, whatsapp_number, phone_number, email, country, city, source, referred_by_customer_id, status, assigned_staff_id, internal_notes, is_deleted, created_at, updated_at, last_activity_at)
             VALUES (?, ?, ?, NULL, NULL, NULL, NULL, ?, NULL, 'Active', ?, ?, 0, ?, ?, ?)`
          )
          .bind(
            customerId,
            existing.friend_name,
            existing.friend_whatsapp,
            'Referred by',
            currentUser.id,
            [existing.friend_phone_model ? `Phone model: ${existing.friend_phone_model}` : '', existing.notes || '', existing.referrer_name ? `Referred via web form by ${existing.referrer_name}` : 'Submitted via pak-tel.com/refer-a-friend']
              .filter(Boolean)
              .join('\n'),
            now,
            now,
            now
          )
          .run();
      }
    }

    await db
      .prepare(`UPDATE referral_requests SET status = 'Converted', converted_customer_id = ?, updated_at = ? WHERE id = ?`)
      .bind(customerId, now, id)
      .run();

    await logAudit(db, {
      staff_id: currentUser.id,
      staff_name: currentUser.name,
      action: 'CREATE',
      record_type: 'CUSTOMER',
      record_id: customerId!,
      change_summary: `${currentUser.name} converted referral request ${id} into customer ${customerId}`,
    });

    return c.json({ success: true, message: 'Converted to customer.', customer_id: customerId });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || 'Failed to convert referral.' }, 500);
  }
});

// Get referrals overview and list
referralsApp.get('/', async (c) => {
  try {
    const db = c.env.DB;
    const { search } = c.req.query();

    // 1. Grouped by referrer customer
    let referrerQuery = `
      SELECT 
        r.id AS referrer_id,
        r.full_name AS referrer_name,
        r.whatsapp_number AS referrer_phone,
        r.email AS referrer_email,
        r.status AS referrer_status,
        COUNT(c.id) AS total_referred_count,
        SUM(CASE WHEN c.status = 'Active' OR c.status = 'VIP' THEN 1 ELSE 0 END) AS active_referred_count,
        (
          SELECT COUNT(*)
          FROM esims e
          WHERE e.customer_id IN (SELECT c2.id FROM customers c2 WHERE c2.referred_by_customer_id = r.id AND c2.is_deleted = 0)
            AND e.is_deleted = 0
        ) AS total_esims_purchased,
        (
          SELECT COALESCE(SUM(t.selling_price), 0)
          FROM transactions t
          WHERE t.customer_id IN (SELECT c2.id FROM customers c2 WHERE c2.referred_by_customer_id = r.id AND c2.is_deleted = 0)
            AND t.payment_status = 'Paid'
        ) AS total_revenue_generated,
        MAX(c.created_at) AS latest_referral_date
      FROM customers r
      JOIN customers c ON c.referred_by_customer_id = r.id
      WHERE r.is_deleted = 0 AND c.is_deleted = 0
    `;

    const params: any[] = [];
    if (search && search.trim()) {
      referrerQuery += ` AND (r.full_name LIKE ? OR r.whatsapp_number LIKE ? OR r.id LIKE ?)`;
      params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
    }

    referrerQuery += ` GROUP BY r.id ORDER BY total_referred_count DESC, total_revenue_generated DESC`;

    const referrers = await db.prepare(referrerQuery).bind(...params).all<any>();

    // 2. All referred customers list with referrer details
    let referredListQuery = `
      SELECT 
        c.id,
        c.full_name,
        c.whatsapp_number,
        c.email,
        c.status,
        c.created_at,
        r.id AS referrer_id,
        r.full_name AS referrer_name,
        r.whatsapp_number AS referrer_phone,
        (SELECT COUNT(*) FROM esims e WHERE e.customer_id = c.id AND e.is_deleted = 0) AS esim_count,
        (SELECT COALESCE(SUM(t.selling_price), 0) FROM transactions t WHERE t.customer_id = c.id AND t.payment_status = 'Paid') AS total_spent
      FROM customers c
      JOIN customers r ON c.referred_by_customer_id = r.id
      WHERE c.is_deleted = 0 AND r.is_deleted = 0
      ORDER BY c.created_at DESC
    `;

    const referredCustomers = await db.prepare(referredListQuery).all<any>();

    const totalReferrals = (referredCustomers.results || []).length;
    const totalReferrers = (referrers.results || []).length;
    const totalReferralRevenue = (referredCustomers.results || []).reduce((sum: number, item: any) => sum + (Number(item.total_spent) || 0), 0);

    return c.json({
      success: true,
      referrers: referrers.results || [],
      referred_customers: referredCustomers.results || [],
      summary: {
        total_referrals: totalReferrals,
        total_unique_referrers: totalReferrers,
        total_referral_revenue: totalReferralRevenue,
      },
    });
  } catch (err: any) {
    console.error('Referrals error:', err);
    return c.json({
      success: true,
      referrers: [],
      referred_customers: [],
      summary: { total_referrals: 0, total_unique_referrers: 0, total_referral_revenue: 0 },
    });
  }
});

export default referralsApp;
