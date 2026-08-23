import { Hono } from 'hono';
import { Env, StaffUser, Transaction } from '../types';
import { authMiddleware } from '../auth';
import { logTimeline, logAudit, generateId } from '../db';

const transactionsApp = new Hono<{ Bindings: Env; Variables: { user: StaffUser } }>();

transactionsApp.use('*', authMiddleware);

// List transactions
transactionsApp.get('/', async (c) => {
  try {
    const db = c.env.DB;
    const {
      search,
      transaction_type,
      payment_method,
      payment_status,
      customer_id,
      staff_id,
      from_date,
      to_date,
      sort_by = 'date',
      order = 'desc',
      page = '1',
      limit = '50',
    } = c.req.query();

    let query = `
      SELECT 
        t.*,
        c.full_name AS customer_name,
        c.whatsapp_number AS customer_phone,
        u.name AS staff_name,
        e.iccid AS esim_iccid
      FROM transactions t
      JOIN customers c ON t.customer_id = c.id
      LEFT JOIN users u ON t.staff_id = u.id
      LEFT JOIN esims e ON t.esim_id = e.id
      WHERE c.is_deleted = 0
    `;

    const params: any[] = [];

    if (customer_id) {
      query += ` AND t.customer_id = ?`;
      params.push(customer_id);
    }

    if (transaction_type) {
      query += ` AND t.transaction_type = ?`;
      params.push(transaction_type);
    }

    if (payment_method) {
      query += ` AND t.payment_method = ?`;
      params.push(payment_method);
    }

    if (payment_status) {
      query += ` AND t.payment_status = ?`;
      params.push(payment_status);
    }

    if (staff_id) {
      query += ` AND t.staff_id = ?`;
      params.push(staff_id);
    }

    if (from_date) {
      query += ` AND t.date >= ?`;
      params.push(from_date);
    }

    if (to_date) {
      query += ` AND t.date <= ?`;
      params.push(to_date);
    }

    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      query += ` AND (
        t.id LIKE ? OR
        t.reference_id LIKE ? OR
        t.package_name LIKE ? OR
        c.full_name LIKE ? OR
        c.whatsapp_number LIKE ? OR
        e.iccid LIKE ?
      )`;
      params.push(s, s, s, s, s, s);
    }

    const sortCol = sort_by === 'selling_price' ? 't.selling_price' : sort_by === 'profit' ? 't.profit' : 't.date';
    const sortDir = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

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

    // Summary metrics in PKR
    let summaryQuery = `
      SELECT 
        SUM(CASE WHEN t.payment_status = 'Paid' THEN t.selling_price ELSE 0 END) AS total_revenue,
        SUM(CASE WHEN t.payment_status = 'Paid' THEN t.cost_price ELSE 0 END) AS total_cost,
        SUM(CASE WHEN t.payment_status = 'Paid' THEN t.profit ELSE 0 END) AS total_profit,
        SUM(CASE WHEN t.payment_status = 'Paid' THEN 1 ELSE 0 END) AS paid_count,
        SUM(CASE WHEN t.payment_status = 'Pending' THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN t.payment_status = 'Refunded' THEN 1 ELSE 0 END) AS refunded_count
      FROM transactions t
      JOIN customers c ON t.customer_id = c.id
      WHERE c.is_deleted = 0
    `;
    const summaryParams: any[] = [];
    if (customer_id) { summaryQuery += ` AND t.customer_id = ?`; summaryParams.push(customer_id); }
    if (transaction_type) { summaryQuery += ` AND t.transaction_type = ?`; summaryParams.push(transaction_type); }
    if (payment_method) { summaryQuery += ` AND t.payment_method = ?`; summaryParams.push(payment_method); }
    if (payment_status) { summaryQuery += ` AND t.payment_status = ?`; summaryParams.push(payment_status); }
    if (from_date) { summaryQuery += ` AND t.date >= ?`; summaryParams.push(from_date); }
    if (to_date) { summaryQuery += ` AND t.date <= ?`; summaryParams.push(to_date); }

    const summary = await db.prepare(summaryQuery).bind(...summaryParams).first<{
      total_revenue: number;
      total_cost: number;
      total_profit: number;
      paid_count: number;
      pending_count: number;
      refunded_count: number;
    }>();

    return c.json({
      success: true,
      transactions: results.results || [],
      summary: {
        total_revenue: Number(summary?.total_revenue || 0),
        total_cost: Number(summary?.total_cost || 0),
        total_profit: Number(summary?.total_profit || 0),
        paid_count: summary?.paid_count || 0,
        pending_count: summary?.pending_count || 0,
        refunded_count: summary?.refunded_count || 0,
      },
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err: any) {
    console.error('List transactions error:', err);
    return c.json({
      success: true,
      transactions: [],
      summary: { total_revenue: 0, total_cost: 0, total_profit: 0, paid_count: 0, pending_count: 0, refunded_count: 0 },
      pagination: { total: 0, page: 1, limit: 50, totalPages: 1 },
    });
  }
});

// Single transaction
transactionsApp.get('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const txnId = c.req.param('id');

    const transaction = await db
      .prepare(
        `SELECT 
          t.*,
          c.full_name AS customer_name,
          c.whatsapp_number AS customer_phone,
          c.email AS customer_email,
          u.name AS staff_name,
          e.iccid AS esim_iccid,
          e.country_region AS esim_country
         FROM transactions t
         JOIN customers c ON t.customer_id = c.id
         LEFT JOIN users u ON t.staff_id = u.id
         LEFT JOIN esims e ON t.esim_id = e.id
         WHERE t.id = ?`
      )
      .bind(txnId)
      .first<any>();

    if (!transaction) {
      return c.json({ success: false, error: 'Transaction not found.' }, 404);
    }

    return c.json({ success: true, transaction });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to fetch transaction.' }, 500);
  }
});

// Create Transaction
transactionsApp.post('/', async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');
    const body = await c.req.json<{
      customer_id: string;
      esim_id?: string;
      transaction_type: string;
      package_name?: string;
      data_allowance?: string;
      duration?: string;
      date?: string;
      selling_price: number;
      cost_price?: number;
      currency?: string;
      payment_method: string;
      payment_status?: string;
      reference_id?: string;
      notes?: string;
    }>();

    if (!body.customer_id) {
      return c.json({ success: false, error: 'Customer is required.' }, 400);
    }
    if (body.selling_price === undefined || isNaN(body.selling_price)) {
      return c.json({ success: false, error: 'Valid selling price is required.' }, 400);
    }

    const customer = await db
      .prepare(`SELECT id, full_name FROM customers WHERE id = ? AND is_deleted = 0`)
      .bind(body.customer_id)
      .first<{ id: string; full_name: string }>();

    if (!customer) {
      return c.json({ success: false, error: 'Customer not found.' }, 404);
    }

    const now = new Date().toISOString();
    const txnId = await generateId(db, 'transactions', 'TXN', 3001);
    const sellPrice = Number(body.selling_price || 0);
    const costPrice = Number(body.cost_price || 0);
    const profit = sellPrice - costPrice;

    await db
      .prepare(
        `INSERT INTO transactions (
          id, customer_id, esim_id, transaction_type, package_name,
          data_allowance, duration, date, selling_price, cost_price,
          profit, currency, payment_method, payment_status, staff_id,
          reference_id, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PKR', ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        txnId,
        body.customer_id,
        body.esim_id || null,
        body.transaction_type || 'New eSIM',
        body.package_name?.trim() || null,
        body.data_allowance?.trim() || null,
        body.duration?.trim() || null,
        body.date || now,
        sellPrice,
        costPrice,
        profit,
        body.payment_method || 'Easypaisa',
        body.payment_status || 'Paid',
        currentUser.id,
        body.reference_id?.trim() || null,
        body.notes?.trim() || null,
        now,
        now
      )
      .run();

    await logTimeline(db, {
      customer_id: body.customer_id,
      staff_id: currentUser.id,
      action_type: 'TRANSACTION_RECORDED',
      title: `${body.transaction_type || 'Transaction'}: Rs. ${sellPrice.toLocaleString()}`,
      description: `${currentUser.name} recorded ${body.payment_status || 'Paid'} ${body.transaction_type} payment of Rs. ${sellPrice.toLocaleString()} via ${body.payment_method || 'Easypaisa'}.`,
      metadata: { txn_id: txnId, amount: sellPrice, method: body.payment_method },
    });

    const clientIp = c.req.header('cf-connecting-ip') || '127.0.0.1';
    await logAudit(db, {
      staff_id: currentUser.id,
      staff_name: currentUser.name,
      action: 'CREATE',
      record_type: 'TRANSACTION',
      record_id: txnId,
      new_value: { customer_id: body.customer_id, amount: sellPrice, method: body.payment_method, type: body.transaction_type },
      change_summary: `Recorded ${body.transaction_type} (Rs. ${sellPrice.toLocaleString()}) for ${customer.full_name}`,
      ip_address: clientIp,
    });

    return c.json({
      success: true,
      message: 'Transaction recorded successfully.',
      transaction_id: txnId,
    });
  } catch (err: any) {
    console.error('Create transaction error:', err);
    return c.json({ success: false, error: 'Failed to record transaction.' }, 500);
  }
});

// Update Transaction
transactionsApp.put('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');
    const txnId = c.req.param('id');
    const body = await c.req.json<Partial<Transaction>>();

    const existing = await db
      .prepare(`SELECT * FROM transactions WHERE id = ?`)
      .bind(txnId)
      .first<Transaction>();

    if (!existing) {
      return c.json({ success: false, error: 'Transaction not found.' }, 404);
    }

    const now = new Date().toISOString();
    const sellPrice = body.selling_price !== undefined ? Number(body.selling_price) : existing.selling_price;
    const costPrice = body.cost_price !== undefined ? Number(body.cost_price) : existing.cost_price;
    const profit = sellPrice - costPrice;

    await db
      .prepare(
        `UPDATE transactions SET
          transaction_type = ?,
          package_name = ?,
          data_allowance = ?,
          duration = ?,
          date = ?,
          selling_price = ?,
          cost_price = ?,
          profit = ?,
          payment_method = ?,
          payment_status = ?,
          reference_id = ?,
          notes = ?,
          updated_at = ?
         WHERE id = ?`
      )
      .bind(
        body.transaction_type || existing.transaction_type,
        body.package_name !== undefined ? body.package_name : existing.package_name,
        body.data_allowance !== undefined ? body.data_allowance : existing.data_allowance,
        body.duration !== undefined ? body.duration : existing.duration,
        body.date || existing.date,
        sellPrice,
        costPrice,
        profit,
        body.payment_method || existing.payment_method,
        body.payment_status || existing.payment_status,
        body.reference_id !== undefined ? body.reference_id : existing.reference_id,
        body.notes !== undefined ? body.notes : existing.notes,
        now,
        txnId
      )
      .run();

    const clientIp = c.req.header('cf-connecting-ip') || '127.0.0.1';
    await logAudit(db, {
      staff_id: currentUser.id,
      staff_name: currentUser.name,
      action: 'UPDATE',
      record_type: 'TRANSACTION',
      record_id: txnId,
      previous_value: existing,
      new_value: body,
      change_summary: `${currentUser.name} updated transaction ${txnId}`,
      ip_address: clientIp,
    });

    return c.json({ success: true, message: 'Transaction updated successfully.' });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to update transaction.' }, 500);
  }
});

// Delete Transaction
transactionsApp.delete('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');
    const txnId = c.req.param('id');

    const existing = await db
      .prepare(`SELECT * FROM transactions WHERE id = ?`)
      .bind(txnId)
      .first<Transaction>();

    if (!existing) {
      return c.json({ success: false, error: 'Transaction not found.' }, 404);
    }

    await db.prepare(`DELETE FROM transactions WHERE id = ?`).bind(txnId).run();

    const clientIp = c.req.header('cf-connecting-ip') || '127.0.0.1';
    await logAudit(db, {
      staff_id: currentUser.id,
      staff_name: currentUser.name,
      action: 'DELETE',
      record_type: 'TRANSACTION',
      record_id: txnId,
      previous_value: existing,
      change_summary: `${currentUser.name} deleted transaction ${txnId} (Rs. ${existing.selling_price})`,
      ip_address: clientIp,
    });

    return c.json({ success: true, message: 'Transaction deleted successfully.' });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to delete transaction.' }, 500);
  }
});

export default transactionsApp;
