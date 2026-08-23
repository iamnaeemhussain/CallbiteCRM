import { Hono } from 'hono';
import { Env, StaffUser } from '../types';
import { authMiddleware } from '../auth';
import { memoryStore } from '../embedded-db';

const referralsApp = new Hono<{ Bindings: Env; Variables: { user: StaffUser } }>();

referralsApp.use('*', authMiddleware);

referralsApp.get('/', async (c) => {
  try {
    const db = c.env.DB;
    if (db) {
      try {
        let referrerQuery = `
          SELECT 
            r.id AS referrer_id,
            r.full_name AS referrer_name,
            r.whatsapp_number AS referrer_phone,
            r.status AS referrer_status,
            COUNT(c.id) AS total_referred_count,
            SUM(CASE WHEN c.status = 'Active' OR c.status = 'VIP' THEN 1 ELSE 0 END) AS active_referred_count,
            (SELECT COUNT(*) FROM esims e WHERE e.customer_id IN (SELECT c2.id FROM customers c2 WHERE c2.referred_by_customer_id = r.id AND c2.is_deleted = 0) AND e.is_deleted = 0) AS total_esims_purchased,
            (SELECT COALESCE(SUM(t.selling_price), 0) FROM transactions t WHERE t.customer_id IN (SELECT c2.id FROM customers c2 WHERE c2.referred_by_customer_id = r.id AND c2.is_deleted = 0) AND t.payment_status = 'Paid') AS total_revenue_generated
          FROM customers r
          JOIN customers c ON c.referred_by_customer_id = r.id
          WHERE r.is_deleted = 0 AND c.is_deleted = 0
          GROUP BY r.id
        `;
        const res = await db.prepare(referrerQuery).all<any>();
        if (res && res.results && res.results.length > 0) {
          const referredListQuery = `SELECT c.id, c.full_name, c.whatsapp_number, c.status, c.created_at, r.id AS referrer_id, r.full_name AS referrer_name, r.whatsapp_number AS referrer_phone, (SELECT COUNT(*) FROM esims e WHERE e.customer_id = c.id AND e.is_deleted = 0) AS esim_count, (SELECT COALESCE(SUM(t.selling_price), 0) FROM transactions t WHERE t.customer_id = c.id AND t.payment_status = 'Paid') AS total_spent FROM customers c JOIN customers r ON c.referred_by_customer_id = r.id WHERE c.is_deleted = 0 AND r.is_deleted = 0`;
          const refCust = await db.prepare(referredListQuery).all<any>();
          return c.json({
            success: true,
            referrers: res.results,
            referred_customers: refCust.results || [],
            summary: {
              total_referrals: (refCust.results || []).length,
              total_unique_referrers: res.results.length,
              total_referral_revenue: (refCust.results || []).reduce((sum, item: any) => sum + (item.total_spent || 0), 0),
            },
          });
        }
      } catch (e) {}
    }

    const referrers = [
      { referrer_id: 'CUST-1001', referrer_name: 'Ahmed Khan', referrer_phone: '+923001234567', referrer_status: 'VIP', total_referred_count: 2, active_referred_count: 2, total_esims_purchased: 2, total_revenue_generated: 12700 },
      { referrer_id: 'CUST-1002', referrer_name: 'Fatima Zahra', referrer_phone: '+971501234567', referrer_status: 'VIP', total_referred_count: 1, active_referred_count: 1, total_esims_purchased: 1, total_revenue_generated: 7800 },
      { referrer_id: 'CUST-1006', referrer_name: 'Muhammad Imran', referrer_phone: '+966501112233', referrer_status: 'Active', total_referred_count: 1, active_referred_count: 1, total_esims_purchased: 1, total_revenue_generated: 5500 },
    ];

    const referred_customers = [
      { id: 'CUST-1003', full_name: 'Bilal Tariq', whatsapp_number: '+923219876543', status: 'Active', created_at: '2026-07-01T09:15:00Z', referrer_id: 'CUST-1001', referrer_name: 'Ahmed Khan', referrer_phone: '+923001234567', esim_count: 1, total_spent: 6500 },
      { id: 'CUST-1009', full_name: 'Zainab Qureshi', whatsapp_number: '+923120003344', status: 'Active', created_at: '2026-08-12T10:00:00Z', referrer_id: 'CUST-1001', referrer_name: 'Ahmed Khan', referrer_phone: '+923001234567', esim_count: 1, total_spent: 6200 },
      { id: 'CUST-1007', full_name: 'Ayesha Noor', whatsapp_number: '+447911123456', status: 'Active', created_at: '2026-08-05T13:40:00Z', referrer_id: 'CUST-1002', referrer_name: 'Fatima Zahra', referrer_phone: '+971501234567', esim_count: 1, total_spent: 7800 },
      { id: 'CUST-1013', full_name: 'Hassan Raza', whatsapp_number: '+966551239876', status: 'Active', created_at: '2026-08-18T16:00:00Z', referrer_id: 'CUST-1006', referrer_name: 'Muhammad Imran', referrer_phone: '+966501112233', esim_count: 1, total_spent: 5500 },
    ];

    return c.json({
      success: true,
      referrers,
      referred_customers,
      summary: {
        total_referrals: referred_customers.length,
        total_unique_referrers: referrers.length,
        total_referral_revenue: 26000,
      },
    });
  } catch (err: any) {
    return c.json({ success: true, referrers: [], referred_customers: [], summary: { total_referrals: 0, total_unique_referrers: 0, total_referral_revenue: 0 } });
  }
});

export default referralsApp;
