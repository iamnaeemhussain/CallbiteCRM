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

    const addDays = (d: Date, days: number) => {
      const copy = new Date(d);
      copy.setDate(copy.getDate() + days);
      return copy.toISOString().slice(0, 10);
    };

    const in3DaysStr = addDays(now, 3);

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
        `SELECT e.*, COALESCE(e.holder_name, 'Unassigned') AS customer_name, e.holder_phone AS customer_phone
         FROM esims e
         WHERE e.is_deleted = 0 AND e.status != 'Cancelled'
           AND e.expiry_date >= ? AND e.expiry_date <= ?
         ORDER BY e.expiry_date ASC LIMIT 8`
      )
      .bind(todayStr, in3DaysStr)
      .all();

    return c.json({
      success: true,
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
      },
    });
  } catch (err: any) {
    console.error('Dashboard error:', err);
    return c.json({
      success: true,
      esims: { total: 0, active: 0, pending: 0, expired: 0 },
      expiry: { expired: 0, expiring_today: 0, expiring_3_days: 0 },
      attention: { expiring_esims: [] },
    });
  }
});

export default dashboardApp;
