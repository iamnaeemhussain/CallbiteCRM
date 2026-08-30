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
          esims: [],
        },
      });
    }

    const clean = q.trim();
    const s = `%${clean}%`;

    const esims = await db
      .prepare(
        `SELECT
          e.id, e.iccid, e.package_name, e.data_allowance, e.country_region, e.expiry_date, e.status,
          COALESCE(e.holder_name, 'Unassigned') AS customer_name,
          e.holder_phone AS customer_phone
         FROM esims e
         WHERE e.is_deleted = 0 AND (
           e.iccid LIKE ? OR
           e.id LIKE ? OR
           e.package_name LIKE ? OR
           e.country_region LIKE ? OR
           e.holder_name LIKE ? OR
           e.holder_phone LIKE ?
         )
         LIMIT 12`
      )
      .bind(s, s, s, s, s, s)
      .all<any>();

    return c.json({
      success: true,
      query: clean,
      results: {
        esims: esims.results || [],
      },
    });
  } catch (err: any) {
    console.error('Global search error:', err);
    return c.json({ success: false, error: 'Search failed.' }, 500);
  }
});

export default searchApp;
