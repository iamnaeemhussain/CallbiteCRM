import { Hono } from 'hono';
import { Env, StaffUser } from '../types';
import { authMiddleware } from '../auth';

const searchApp = new Hono<{ Bindings: Env; Variables: { user: StaffUser } }>();

searchApp.use('*', authMiddleware);

searchApp.get('/', async (c) => {
  try {
    const db = c.env.DB;
    const { q } = c.req.query();

    if (!q || !q.trim()) {
      return c.json({
        success: true,
        results: {
          customers: [],
          esims: [],
          transactions: [],
          support_tickets: [],
        },
      });
    }

    const clean = q.trim();
    const s = `%${clean}%`;

    // 1. Search Customers (by name, phone, whatsapp, email, id)
    const customers = await db
      .prepare(
        `SELECT 
          c.id, c.full_name, c.whatsapp_number, c.phone_number, c.email, c.status, c.source,
          (SELECT COUNT(*) FROM esims e WHERE e.customer_id = c.id AND e.is_deleted = 0) AS esim_count
         FROM customers c
         WHERE c.is_deleted = 0 AND (
           c.full_name LIKE ? OR
           c.whatsapp_number LIKE ? OR
           c.phone_number LIKE ? OR
           c.email LIKE ? OR
           c.id LIKE ?
         )
         LIMIT 8`
      )
      .bind(s, s, s, s, s)
      .all<any>();

    // 2. Search eSIMs (by ICCID, ID, country, package name)
    const esims = await db
      .prepare(
        `SELECT 
          e.id, e.iccid, e.package_name, e.data_allowance, e.country_region, e.expiry_date, e.status, e.customer_id,
          c.full_name AS customer_name, c.whatsapp_number AS customer_phone
         FROM esims e
         JOIN customers c ON e.customer_id = c.id
         WHERE e.is_deleted = 0 AND c.is_deleted = 0 AND (
           e.iccid LIKE ? OR
           e.id LIKE ? OR
           e.package_name LIKE ? OR
           e.country_region LIKE ?
         )
         LIMIT 8`
      )
      .bind(s, s, s, s)
      .all<any>();

    // 3. Search Transactions (by ID, reference)
    const transactions = await db
      .prepare(
        `SELECT 
          t.id, t.transaction_type, t.package_name, t.selling_price, t.payment_method, t.payment_status, t.date, t.customer_id,
          c.full_name AS customer_name
         FROM transactions t
         JOIN customers c ON t.customer_id = c.id
         WHERE (
           t.id LIKE ? OR
           t.reference_id LIKE ? OR
           t.package_name LIKE ?
         )
         LIMIT 6`
      )
      .bind(s, s, s)
      .all<any>();

    // 4. Search Support Tickets (by ID, description, issue type)
    const supportTickets = await db
      .prepare(
        `SELECT 
          s.id, s.issue_type, s.priority, s.status, s.description, s.created_at, s.customer_id,
          c.full_name AS customer_name
         FROM support_tickets s
         JOIN customers c ON s.customer_id = c.id
         WHERE (
           s.id LIKE ? OR
           s.description LIKE ? OR
           s.issue_type LIKE ?
         )
         LIMIT 6`
      )
      .bind(s, s, s)
      .all<any>();

    return c.json({
      success: true,
      query: clean,
      results: {
        customers: customers.results || [],
        esims: esims.results || [],
        transactions: transactions.results || [],
        support_tickets: supportTickets.results || [],
      },
    });
  } catch (err: any) {
    console.error('Global search error:', err);
    return c.json({ success: false, error: 'Search failed.' }, 500);
  }
});

export default searchApp;
