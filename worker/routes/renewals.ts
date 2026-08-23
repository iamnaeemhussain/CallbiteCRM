import { Hono } from 'hono';
import { Env, StaffUser, Esim } from '../types';
import { authMiddleware } from '../auth';
import { logTimeline, logAudit, generateId } from '../db';

const renewalsApp = new Hono<{ Bindings: Env; Variables: { user: StaffUser } }>();

renewalsApp.use('*', authMiddleware);

// Get Renewals Dashboard List
renewalsApp.get('/', async (c) => {
  try {
    const db = c.env.DB;
    const {
      tab = 'all',
      search,
      country,
      sort_by = 'expiry_date',
      order = 'asc',
      page = '1',
      limit = '50',
    } = c.req.query();

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const addDays = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      return d.toISOString().slice(0, 10);
    };

    const in1DayStr = addDays(1);
    const in3DaysStr = addDays(3);
    const in4DaysStr = addDays(4);
    const in7DaysStr = addDays(7);

    let query = `
      SELECT 
        e.*,
        c.full_name AS customer_name,
        c.whatsapp_number AS customer_phone,
        c.email AS customer_email,
        c.status AS customer_status,
        u.name AS created_by_staff_name
      FROM esims e
      JOIN customers c ON e.customer_id = c.id
      LEFT JOIN users u ON e.created_by_staff_id = u.id
      WHERE e.is_deleted = 0 AND c.is_deleted = 0 AND e.status != 'Cancelled'
    `;

    const params: any[] = [];

    if (tab === 'expired') {
      query += ` AND e.expiry_date < ?`;
      params.push(todayStr);
    } else if (tab === 'today') {
      query += ` AND e.expiry_date = ?`;
      params.push(todayStr);
    } else if (tab === 'three_days') {
      query += ` AND e.expiry_date >= ? AND e.expiry_date <= ?`;
      params.push(in1DayStr, in3DaysStr);
    } else if (tab === 'seven_days') {
      query += ` AND e.expiry_date >= ? AND e.expiry_date <= ?`;
      params.push(in4DaysStr, in7DaysStr);
    } else if (tab === 'active') {
      query += ` AND e.expiry_date > ? AND e.status = 'Active'`;
      params.push(in7DaysStr);
    }

    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      query += ` AND (
        e.iccid LIKE ? OR
        e.package_name LIKE ? OR
        e.country_region LIKE ? OR
        c.full_name LIKE ? OR
        c.whatsapp_number LIKE ?
      )`;
      params.push(s, s, s, s, s);
    }

    if (country) {
      query += ` AND e.country_region LIKE ?`;
      params.push(`%${country}%`);
    }

    const sortCol = sort_by === 'created_at' ? 'e.created_at' : sort_by === 'customer_name' ? 'c.full_name' : 'e.expiry_date';
    const sortDir = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    query += ` ORDER BY ${sortCol} ${sortDir}`;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    const countQuery = `SELECT COUNT(*) AS total FROM (${query})`;
    const countResult = await db.prepare(countQuery).bind(...params).first<{ total: number }>();
    const total = countResult?.total || 0;

    query += ` LIMIT ? OFFSET ?`;
    params.push(limitNum, offset);

    const results = await db.prepare(query).bind(...params).all<any>();

    // Renewal Summary Counts
    const counts = await db
      .prepare(
        `SELECT
          SUM(CASE WHEN expiry_date < ? AND status != 'Cancelled' THEN 1 ELSE 0 END) AS expired,
          SUM(CASE WHEN expiry_date = ? AND status != 'Cancelled' THEN 1 ELSE 0 END) AS today,
          SUM(CASE WHEN expiry_date >= ? AND expiry_date <= ? AND status != 'Cancelled' THEN 1 ELSE 0 END) AS three_days,
          SUM(CASE WHEN expiry_date >= ? AND expiry_date <= ? AND status != 'Cancelled' THEN 1 ELSE 0 END) AS seven_days,
          SUM(CASE WHEN expiry_date > ? AND status = 'Active' THEN 1 ELSE 0 END) AS active
         FROM esims WHERE is_deleted = 0`
      )
      .bind(todayStr, todayStr, in1DayStr, in3DaysStr, in4DaysStr, in7DaysStr, in7DaysStr)
      .first<{
        expired: number;
        today: number;
        three_days: number;
        seven_days: number;
        active: number;
      }>();

    return c.json({
      success: true,
      renewals: results.results || [],
      counts: {
        expired: counts?.expired || 0,
        today: counts?.today || 0,
        three_days: counts?.three_days || 0,
        seven_days: counts?.seven_days || 0,
        active: counts?.active || 0,
        total: (counts?.expired || 0) + (counts?.today || 0) + (counts?.three_days || 0) + (counts?.seven_days || 0) + (counts?.active || 0),
      },
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err: any) {
    console.error('Renewals error:', err);
    return c.json({ success: true, renewals: [], counts: { expired: 0, today: 0, three_days: 0, seven_days: 0, active: 0, total: 0 }, pagination: { total: 0, page: 1, limit: 50, totalPages: 1 } });
  }
});

// Process Manual Renewal
renewalsApp.post('/', async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');
    const body = await c.req.json<{
      customer_id: string;
      esim_id: string;
      package_name: string;
      data_allowance: string;
      duration: string;
      new_expiry_date: string;
      renewal_date?: string;
      selling_price: number;
      cost_price?: number;
      payment_method: string;
      payment_status?: string;
      reference_id?: string;
      notes?: string;
    }>();

    if (!body.esim_id || !body.customer_id) {
      return c.json({ success: false, error: 'Customer and eSIM are required.' }, 400);
    }
    if (!body.new_expiry_date) {
      return c.json({ success: false, error: 'New Expiry Date is required.' }, 400);
    }
    if (body.selling_price === undefined || isNaN(body.selling_price)) {
      return c.json({ success: false, error: 'Valid selling price is required.' }, 400);
    }

    const existingEsim = await db
      .prepare(`SELECT * FROM esims WHERE id = ? AND is_deleted = 0`)
      .bind(body.esim_id)
      .first<Esim>();

    if (!existingEsim) {
      return c.json({ success: false, error: 'eSIM not found.' }, 404);
    }

    const customer = await db
      .prepare(`SELECT * FROM customers WHERE id = ? AND is_deleted = 0`)
      .bind(body.customer_id)
      .first<{ id: string; full_name: string }>();

    if (!customer) {
      return c.json({ success: false, error: 'Customer not found.' }, 404);
    }

    const now = new Date().toISOString();
    const renewalDate = body.renewal_date || now.slice(0, 10);
    const sellPrice = Number(body.selling_price || 0);
    const costPrice = Number(body.cost_price || 0);
    const profit = sellPrice - costPrice;

    // 1. Update eSIM record
    await db
      .prepare(
        `UPDATE esims SET
          package_name = ?,
          data_allowance = ?,
          duration = ?,
          expiry_date = ?,
          renewal_date = ?,
          status = 'Active',
          notes = CASE WHEN ? IS NOT NULL THEN ? ELSE notes END,
          updated_at = ?
         WHERE id = ?`
      )
      .bind(
        body.package_name || existingEsim.package_name,
        body.data_allowance || existingEsim.data_allowance,
        body.duration || existingEsim.duration,
        body.new_expiry_date,
        renewalDate,
        body.notes?.trim() || null,
        body.notes?.trim() || null,
        now,
        body.esim_id
      )
      .run();

    // 2. Automatically Record Transaction in PKR
    const txnId = await generateId(db, 'transactions', 'TXN', 3001);
    await db
      .prepare(
        `INSERT INTO transactions (
          id, customer_id, esim_id, transaction_type, package_name,
          data_allowance, duration, date, selling_price, cost_price,
          profit, currency, payment_method, payment_status, staff_id,
          reference_id, notes, created_at, updated_at
        ) VALUES (?, ?, ?, 'Renewal', ?, ?, ?, ?, ?, ?, ?, 'PKR', ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        txnId,
        body.customer_id,
        body.esim_id,
        body.package_name || existingEsim.package_name,
        body.data_allowance || existingEsim.data_allowance,
        body.duration || existingEsim.duration,
        now,
        sellPrice,
        costPrice,
        profit,
        body.payment_method || 'Easypaisa',
        body.payment_status || 'Paid',
        currentUser.id,
        body.reference_id?.trim() || null,
        body.notes?.trim() || 'Manual renewal processed by staff',
        now,
        now
      )
      .run();

    // 3. Automatically Log Activity Timeline
    const timelineDesc = `${currentUser.name} renewed ${body.package_name || existingEsim.package_name}. Expiry extended from ${existingEsim.expiry_date} to ${body.new_expiry_date}. Payment of Rs. ${sellPrice.toLocaleString()} via ${body.payment_method || 'Easypaisa'}.`;
    await logTimeline(db, {
      customer_id: body.customer_id,
      staff_id: currentUser.id,
      action_type: 'ESIM_RENEWED',
      title: `eSIM Renewed: ${body.package_name || existingEsim.package_name}`,
      description: timelineDesc,
      metadata: {
        esim_id: body.esim_id,
        iccid: existingEsim.iccid,
        old_expiry: existingEsim.expiry_date,
        new_expiry: body.new_expiry_date,
        amount: sellPrice,
        txn_id: txnId,
      },
    });

    // 4. Automatically Log Audit Log
    const clientIp = c.req.header('cf-connecting-ip') || '127.0.0.1';
    await logAudit(db, {
      staff_id: currentUser.id,
      staff_name: currentUser.name,
      action: 'RENEWAL',
      record_type: 'ESIM',
      record_id: body.esim_id,
      previous_value: { expiry_date: existingEsim.expiry_date, package_name: existingEsim.package_name },
      new_value: { expiry_date: body.new_expiry_date, package_name: body.package_name, transaction_id: txnId },
      change_summary: `${currentUser.name} changed Expiry: ${existingEsim.expiry_date} → ${body.new_expiry_date} (Renewal)`,
      ip_address: clientIp,
    });

    return c.json({
      success: true,
      message: 'eSIM renewed successfully and transaction recorded.',
      transaction_id: txnId,
      new_expiry_date: body.new_expiry_date,
    });
  } catch (err: any) {
    console.error('Process renewal error:', err);
    return c.json({ success: false, error: err.message || 'Failed to process renewal.' }, 500);
  }
});

export default renewalsApp;
