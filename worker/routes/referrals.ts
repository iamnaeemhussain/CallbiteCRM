import { Hono } from 'hono';
import { Env, StaffUser } from '../types';
import { authMiddleware } from '../auth';

const referralsApp = new Hono<{ Bindings: Env; Variables: { user: StaffUser } }>();

referralsApp.use('*', authMiddleware);

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
          SELECT COALESEF(SUM(t.selling_price), 0)
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

    // Note: in SQLite `COALESCE` is the function name
    referrerQuery = referrerQuery.replace('COALESEF', 'COALESCE');

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

    // Summary metrics
    const totalReferrals = (referredCustomers.results || []).length;
    const totalReferrers = (referrers.results || []).length;
    const totalReferralRevenue = (referredCustomers.results || []).reduce((sum: number, item: any) => sum + (item.total_spent || 0), 0);

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
    return c.json({ success: false, error: 'Failed to fetch referrals.' }, 500);
  }
});

export default referralsApp;
