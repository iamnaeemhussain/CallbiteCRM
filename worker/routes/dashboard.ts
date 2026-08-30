import { Hono } from 'hono';
import { Env, StaffUser } from '../types';
import { authMiddleware } from '../auth';

const dashboardApp = new Hono<{ Bindings: Env; Variables: { user: StaffUser } }>();

dashboardApp.use('*', authMiddleware);

dashboardApp.get('/stats', async (c) => {
  try {
    const db = c.env.DB;
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const startOfMonth = `${todayStr.slice(0, 7)}-01`;

    const addDays = (d: Date, days: number) => {
      const copy = new Date(d);
      copy.setDate(copy.getDate() + days);
      return copy.toISOString().slice(0, 10);
    };

    const in3DaysStr = addDays(now, 3);

    const custStats = await db
      .prepare(
        `SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) AS active,
          SUM(CASE WHEN status = 'VIP' THEN 1 ELSE 0 END) AS vip,
          SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS new_this_month
         FROM customers WHERE is_deleted = 0`
      )
      .bind(startOfMonth)
      .first<{ total: number; active: number; vip: number; new_this_month: number }>();

    const esimStats = await db
      .prepare(
        `SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) AS active,
          SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN status = 'Expired' THEN 1 ELSE 0 END) AS expired
         FROM esims WHERE is_deleted = 0`
      )
      .first<{ total: number; active: number; pending: number; expired: number }>();

    const expiryStats = await db
      .prepare(
        `SELECT
          SUM(CASE WHEN expiry_date < ? AND status != 'Cancelled' THEN 1 ELSE 0 END) AS expired,
          SUM(CASE WHEN expiry_date = ? AND status != 'Cancelled' THEN 1 ELSE 0 END) AS expiring_today,
          SUM(CASE WHEN expiry_date >= ? AND expiry_date <= ? AND status != 'Cancelled' THEN 1 ELSE 0 END) AS expiring_3_days
         FROM esims WHERE is_deleted = 0`
      )
      .bind(todayStr, todayStr, todayStr, in3DaysStr)
      .first<{ expired: number; expiring_today: number; expiring_3_days: number }>();

    const expiringEsimsList = await db
      .prepare(
        `SELECT e.*, c.full_name AS customer_name, c.whatsapp_number AS customer_phone
         FROM esims e
         LEFT JOIN customers c ON e.customer_id = c.id
         WHERE e.is_deleted = 0 AND e.status != 'Cancelled'
           AND e.expiry_date >= ? AND e.expiry_date <= ?
         ORDER BY e.expiry_date ASC LIMIT 8`
      )
      .bind(todayStr, in3DaysStr)
      .all();

    const sources = await db
      .prepare(
        `SELECT source, COUNT(*) AS count
         FROM customers
         WHERE is_deleted = 0
         GROUP BY source
         ORDER BY count DESC`
      )
      .all();

    const recentActivity = await db
      .prepare(
        `SELECT a.*, c.full_name AS customer_name, u.name AS staff_name
         FROM activity_timeline a
         JOIN customers c ON a.customer_id = c.id
         LEFT JOIN users u ON a.staff_id = u.id
         ORDER BY a.created_at DESC LIMIT 10`
      )
      .all();

    return c.json({
      success: true,
      customers: {
        total: custStats?.total || 0,
        active: custStats?.active || 0,
        vip: custStats?.vip || 0,
        new_this_month: custStats?.new_this_month || 0,
      },
      esims: {
        total: esimStats?.total || 0,
        active: esimStats?.active || 0,
        pending: esimStats?.pending || 0,
        expired: esimStats?.expired || 0,
      },
      expiry: {
        expired: expiryStats?.expired || 0,
        expiring_today: expiryStats?.expiring_today || 0,
        expiring_3_days: expiryStats?.expiring_3_days || 0,
      },
      attention: {
        expiring_esims: expiringEsimsList.results || [],
        recent_activity: recentActivity.results || [],
      },
      sources: sources.results || [],
    });
  } catch (err: any) {
    console.error('Dashboard error:', err);
    return c.json({
      success: true,
      customers: { total: 0, active: 0, vip: 0, new_this_month: 0 },
      esims: { total: 0, active: 0, pending: 0, expired: 0 },
      expiry: { expired: 0, expiring_today: 0, expiring_3_days: 0 },
      attention: { expiring_esims: [], recent_activity: [] },
      sources: [],
    });
  }
});

export default dashboardApp;
