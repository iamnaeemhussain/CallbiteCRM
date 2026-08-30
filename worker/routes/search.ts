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

    return c.json({
      success: true,
      query: clean,
      results: {
        customers: customers.results || [],
        esims: esims.results || [],
      },
    });
  } catch (err: any) {
    console.error('Global search error:', err);
    return c.json({ success: false, error: 'Search failed.' }, 500);
  }
});

export default searchApp;
