import { Hono } from 'hono';
import { Env, StaffUser } from '../types';
import { authMiddleware } from '../auth';

const dashboardApp = new Hono<{ Bindings: Env; Variables: { user: StaffUser } }>();

dashboardApp.use('*', authMiddleware);

dashboardApp.get('/stats', async (c) => {
  try {
    const db = c.env.DB;
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10); // 'YYYY-MM-DD'
    const startOfMonth = `${todayStr.slice(0, 7)}-01`;
    
    // Add days helper
    const addDays = (d: Date, days: number) => {
      const copy = new Date(d);
      copy.setDate(copy.getDate() + days);
      return copy.toISOString().slice(0, 10);
    };

    const in1DayStr = addDays(now, 1);
    const in3DaysStr = addDays(now, 3);
    const in4DaysStr = addDays(now, 4);
    const in7DaysStr = addDays(now, 7);

    // 1. Customer Statistics
    const custStats = await db
      .prepare(
        `SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) AS active,
          SUM(CASE WHEN status = 'Inactive' THEN 1 ELSE 0 END) AS inactive,
          SUM(CASE WHEN status = 'VIP' THEN 1 ELSE 0 END) AS vip,
          SUM(CASE WHEN status = 'Blocked' THEN 1 ELSE 0 END) AS blocked,
          SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS new_this_month
         FROM customers WHERE is_deleted = 0`
      )
      .bind(startOfMonth)
      .first<{
        total: number;
        active: number;
        inactive: number;
        vip: number;
        blocked: number;
        new_this_month: number;
      }>();

    // 2. eSIM Statistics
    const esimStats = await db
      .prepare(
        `SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) AS active,
          SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN status = 'Expired' THEN 1 ELSE 0 END) AS expired,
          SUM(CASE WHEN status = 'Suspended' THEN 1 ELSE 0 END) AS suspended,
          SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled
         FROM esims WHERE is_deleted = 0`
      )
      .first<{
        total: number;
        active: number;
        pending: number;
        expired: number;
        suspended: number;
        cancelled: number;
      }>();

    // 3. Renewal Statistics
    const renewalStats = await db
      .prepare(
        `SELECT
          SUM(CASE WHEN expiry_date < ? AND status != 'Cancelled' THEN 1 ELSE 0 END) AS expired,
          SUM(CASE WHEN expiry_date = ? AND status != 'Cancelled' THEN 1 ELSE 0 END) AS expiring_today,
          SUM(CASE WHEN expiry_date >= ? AND expiry_date <= ? AND status != 'Cancelled' THEN 1 ELSE 0 END) AS expiring_3_days,
          SUM(CASE WHEN expiry_date >= ? AND expiry_date <= ? AND status != 'Cancelled' THEN 1 ELSE 0 END) AS expiring_7_days,
          SUM(CASE WHEN expiry_date > ? AND status = 'Active' THEN 1 ELSE 0 END) AS active_healthy
         FROM esims WHERE is_deleted = 0`
      )
      .bind(todayStr, todayStr, in1DayStr, in3DaysStr, in4DaysStr, in7DaysStr, in7DaysStr)
      .first<{
        expired: number;
        expiring_today: number;
        expiring_3_days: number;
        expiring_7_days: number;
        active_healthy: number;
      }>();

    // 4. Support Statistics
    const supportStats = await db
      .prepare(
        `SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END) AS open,
          SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress,
          SUM(CASE WHEN status = 'Waiting for Customer' THEN 1 ELSE 0 END) AS waiting_customer,
          SUM(CASE WHEN status = 'Resolved' AND resolved_date >= ? THEN 1 ELSE 0 END) AS resolved_today,
          SUM(CASE WHEN (status = 'Open' OR status = 'In Progress') AND priority = 'Urgent' THEN 1 ELSE 0 END) AS urgent_open
         FROM support_tickets`
      )
      .bind(todayStr)
      .first<{
        total: number;
        open: number;
        in_progress: number;
        waiting_customer: number;
        resolved_today: number;
        urgent_open: number;
      }>();

    // 5. Transaction & Financial Statistics
    const txnStats = await db
      .prepare(
        `SELECT
          SUM(CASE WHEN date >= ? AND payment_status = 'Paid' THEN selling_price ELSE 0 END) AS today_sales,
          SUM(CASE WHEN date >= ? AND payment_status = 'Paid' THEN profit ELSE 0 END) AS today_profit,
          SUM(CASE WHEN date >= ? AND payment_status = 'Paid' THEN selling_price ELSE 0 END) AS month_sales,
          SUM(CASE WHEN date >= ? AND payment_status = 'Paid' THEN profit ELSE 0 END) AS month_profit,
          SUM(CASE WHEN transaction_type = 'Renewal' AND date >= ? THEN 1 ELSE 0 END) AS month_renewals_count,
          SUM(CASE WHEN payment_status = 'Paid' THEN selling_price ELSE 0 END) AS total_revenue,
          SUM(CASE WHEN payment_status = 'Paid' THEN profit ELSE 0 END) AS total_profit
         FROM transactions`
      )
      .bind(todayStr, todayStr, startOfMonth, startOfMonth, startOfMonth)
      .first<{
        today_sales: number;
        today_profit: number;
        month_sales: number;
        month_profit: number;
        month_renewals_count: number;
        total_revenue: number;
        total_profit: number;
      }>();

    // 6. Actionable: Overdue & Today's Tasks
    const overdueTasks = await db
      .prepare(
        `SELECT t.*, c.full_name AS customer_name, c.whatsapp_number AS customer_phone, u.name AS assigned_staff_name
         FROM tasks t
         JOIN customers c ON t.customer_id = c.id
         LEFT JOIN users u ON t.assigned_staff_id = u.id
         WHERE (t.due_date < ? OR (t.due_date = ? AND t.due_time IS NOT NULL AND t.due_time < ?))
           AND t.status != 'Completed'
         ORDER BY t.due_date ASC, t.due_time ASC LIMIT 8`
      )
      .bind(todayStr, todayStr, now.toTimeString().slice(0, 5))
      .all();

    const todayTasks = await db
      .prepare(
        `SELECT t.*, c.full_name AS customer_name, c.whatsapp_number AS customer_phone, u.name AS assigned_staff_name
         FROM tasks t
         JOIN customers c ON t.customer_id = c.id
         LEFT JOIN users u ON t.assigned_staff_id = u.id
         WHERE t.due_date = ? AND t.status != 'Completed'
         ORDER BY t.priority DESC, t.due_time ASC LIMIT 8`
      )
      .bind(todayStr)
      .all();

    // 7. Actionable: Expiring eSIMs (Today + next 3 days)
    const expiringEsimsList = await db
      .prepare(
        `SELECT e.*, c.full_name AS customer_name, c.whatsapp_number AS customer_phone
         FROM esims e
         JOIN customers c ON e.customer_id = c.id
         WHERE e.is_deleted = 0 AND e.status != 'Cancelled'
           AND e.expiry_date >= ? AND e.expiry_date <= ?
         ORDER BY e.expiry_date ASC LIMIT 8`
      )
      .bind(todayStr, in3DaysStr)
      .all();

    // 8. Actionable: Urgent/Open Support Tickets
    const urgentTickets = await db
      .prepare(
        `SELECT s.*, c.full_name AS customer_name, c.whatsapp_number AS customer_phone, u.name AS assigned_staff_name
         FROM support_tickets s
         JOIN customers c ON s.customer_id = c.id
         LEFT JOIN users u ON s.assigned_staff_id = u.id
         WHERE s.status IN ('Open', 'In Progress', 'Waiting for Customer')
         ORDER BY CASE s.priority WHEN 'Urgent' THEN 1 WHEN 'High' THEN 2 WHEN 'Normal' THEN 3 ELSE 4 END, s.created_at DESC
         LIMIT 8`
      )
      .all();

    // 9. Customer Acquisition Sources Breakdown
    const sources = await db
      .prepare(
        `SELECT source, COUNT(*) AS count
         FROM customers
         WHERE is_deleted = 0
         GROUP BY source
         ORDER BY count DESC`
      )
      .all();

    // 10. Last 7 Days Sales Trend
    const recent7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().slice(0, 10);
    });

    const salesTrendRaw = await db
      .prepare(
        `SELECT substr(date, 1, 10) as day, SUM(selling_price) as sales, SUM(profit) as profit, COUNT(*) as count
         FROM transactions
         WHERE date >= ? AND payment_status = 'Paid'
         GROUP BY substr(date, 1, 10)`
      )
      .bind(recent7Days[0])
      .all<{ day: string; sales: number; profit: number; count: number }>();

    const salesTrendMap = new Map((salesTrendRaw.results || []).map((r) => [r.day, r]));
    const salesTrend = recent7Days.map((day) => {
      const data = salesTrendMap.get(day);
      return {
        date: day,
        sales: data ? data.sales || 0 : 0,
        profit: data ? data.profit || 0 : 0,
        count: data ? data.count || 0 : 0,
      };
    });

    // 11. Recent Activity Feed
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
        inactive: custStats?.inactive || 0,
        vip: custStats?.vip || 0,
        blocked: custStats?.blocked || 0,
        new_this_month: custStats?.new_this_month || 0,
      },
      esims: {
        total: esimStats?.total || 0,
        active: esimStats?.active || 0,
        pending: esimStats?.pending || 0,
        expired: esimStats?.expired || 0,
        suspended: esimStats?.suspended || 0,
        cancelled: esimStats?.cancelled || 0,
      },
      renewals: {
        expired: renewalStats?.expired || 0,
        expiring_today: renewalStats?.expiring_today || 0,
        expiring_3_days: renewalStats?.expiring_3_days || 0,
        expiring_7_days: renewalStats?.expiring_7_days || 0,
        active_healthy: renewalStats?.active_healthy || 0,
      },
      support: {
        total: supportStats?.total || 0,
        open: supportStats?.open || 0,
        in_progress: supportStats?.in_progress || 0,
        waiting_customer: supportStats?.waiting_customer || 0,
        resolved_today: supportStats?.resolved_today || 0,
        urgent_open: supportStats?.urgent_open || 0,
      },
      transactions: {
        today_sales: Number(txnStats?.today_sales || 0),
        today_profit: Number(txnStats?.today_profit || 0),
        month_sales: Number(txnStats?.month_sales || 0),
        month_profit: Number(txnStats?.month_profit || 0),
        month_renewals_count: txnStats?.month_renewals_count || 0,
        total_revenue: Number(txnStats?.total_revenue || 0),
        total_profit: Number(txnStats?.total_profit || 0),
      },
      attention: {
        overdue_tasks: overdueTasks.results || [],
        today_tasks: todayTasks.results || [],
        expiring_esims: expiringEsimsList.results || [],
        urgent_tickets: urgentTickets.results || [],
        recent_activity: recentActivity.results || [],
      },
      sources: sources.results || [],
      sales_trend: salesTrend,
    });
  } catch (err: any) {
    console.error('Dashboard error:', err);
    return c.json({ success: false, error: 'Failed to load dashboard statistics.' }, 500);
  }
});

export default dashboardApp;
