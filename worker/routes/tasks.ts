import { Hono } from 'hono';
import { Env, StaffUser, Task } from '../types';
import { authMiddleware } from '../auth';
import { logTimeline, logAudit, generateId } from '../db';

const tasksApp = new Hono<{ Bindings: Env; Variables: { user: StaffUser } }>();

tasksApp.use('*', authMiddleware);

// List tasks
tasksApp.get('/', async (c) => {
  try {
    const db = c.env.DB;
    const {
      status,
      filter,
      priority,
      task_type,
      assigned_staff_id,
      customer_id,
      search,
      sort_by = 'due_date',
      order = 'asc',
      page = '1',
      limit = '50',
    } = c.req.query();

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    let query = `
      SELECT 
        t.*,
        c.full_name AS customer_name,
        c.whatsapp_number AS customer_phone,
        u.name AS assigned_staff_name,
        cu.name AS created_by_staff_name,
        e.package_name AS esim_package
      FROM tasks t
      JOIN customers c ON t.customer_id = c.id
      LEFT JOIN users u ON t.assigned_staff_id = u.id
      LEFT JOIN users cu ON t.created_by_staff_id = cu.id
      LEFT JOIN esims e ON t.esim_id = e.id
      WHERE c.is_deleted = 0
    `;

    const params: any[] = [];

    if (customer_id) {
      query += ` AND t.customer_id = ?`;
      params.push(customer_id);
    }

    if (filter === 'overdue') {
      query += ` AND t.due_date < ? AND t.status != 'Completed'`;
      params.push(todayStr);
    } else if (filter === 'today') {
      query += ` AND t.due_date = ? AND t.status != 'Completed'`;
      params.push(todayStr);
    } else if (filter === 'upcoming') {
      query += ` AND t.due_date > ? AND t.status != 'Completed'`;
      params.push(todayStr);
    } else if (status) {
      query += ` AND t.status = ?`;
      params.push(status);
    }

    if (priority) {
      query += ` AND t.priority = ?`;
      params.push(priority);
    }

    if (task_type) {
      query += ` AND t.task_type = ?`;
      params.push(task_type);
    }

    if (assigned_staff_id) {
      query += ` AND t.assigned_staff_id = ?`;
      params.push(assigned_staff_id);
    }

    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      query += ` AND (
        t.id LIKE ? OR
        t.notes LIKE ? OR
        c.full_name LIKE ? OR
        c.whatsapp_number LIKE ?
      )`;
      params.push(s, s, s, s);
    }

    const sortCol = sort_by === 'priority' ? `CASE t.priority WHEN 'Urgent' THEN 1 WHEN 'High' THEN 2 WHEN 'Normal' THEN 3 ELSE 4 END` : 't.due_date';
    const sortDir = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    query += ` ORDER BY ${sortCol} ${sortDir}, t.due_time ASC`;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    const countQuery = `SELECT COUNT(*) AS total FROM (${query})`;
    const countResult = await db.prepare(countQuery).bind(...params).first<{ total: number }>();
    const total = countResult?.total || 0;

    query += ` LIMIT ? OFFSET ?`;
    params.push(limitNum, offset);

    const results = await db.prepare(query).bind(...params).all<any>();

    // Counts by category
    const counts = await db
      .prepare(
        `SELECT
          SUM(CASE WHEN due_date < ? AND status != 'Completed' THEN 1 ELSE 0 END) AS overdue,
          SUM(CASE WHEN due_date = ? AND status != 'Completed' THEN 1 ELSE 0 END) AS today,
          SUM(CASE WHEN due_date > ? AND status != 'Completed' THEN 1 ELSE 0 END) AS upcoming,
          SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed,
          COUNT(*) AS total
         FROM tasks`
      )
      .bind(todayStr, todayStr, todayStr)
      .first<{
        overdue: number;
        today: number;
        upcoming: number;
        completed: number;
        total: number;
      }>();

    return c.json({
      success: true,
      tasks: results.results || [],
      counts: {
        overdue: counts?.overdue || 0,
        today: counts?.today || 0,
        upcoming: counts?.upcoming || 0,
        completed: counts?.completed || 0,
        total: counts?.total || 0,
      },
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err: any) {
    console.error('List tasks error:', err);
    return c.json({ success: false, error: 'Failed to fetch tasks.' }, 500);
  }
});

// Create task
tasksApp.post('/', async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');
    const body = await c.req.json<{
      customer_id: string;
      esim_id?: string;
      task_type: string;
      due_date: string;
      due_time?: string;
      assigned_staff_id?: string;
      priority?: string;
      notes: string;
    }>();

    if (!body.customer_id || !body.due_date || !body.notes || !body.notes.trim()) {
      return c.json({ success: false, error: 'Customer, due date, and notes are required.' }, 400);
    }

    const customer = await db
      .prepare(`SELECT id, full_name FROM customers WHERE id = ? AND is_deleted = 0`)
      .bind(body.customer_id)
      .first<{ id: string; full_name: string }>();

    if (!customer) {
      return c.json({ success: false, error: 'Customer not found.' }, 404);
    }

    const now = new Date().toISOString();
    const taskId = await generateId(db, 'tasks', 'TSK', 6001);

    await db
      .prepare(
        `INSERT INTO tasks (
          id, customer_id, esim_id, task_type, due_date, due_time,
          assigned_staff_id, priority, status, notes, completed_at,
          created_by_staff_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, NULL, ?, ?, ?)`
      )
      .bind(
        taskId,
        body.customer_id,
        body.esim_id || null,
        body.task_type || 'Customer Follow-up',
        body.due_date,
        body.due_time?.trim() || null,
        body.assigned_staff_id || currentUser.id,
        body.priority || 'Normal',
        body.notes.trim(),
        currentUser.id,
        now,
        now
      )
      .run();

    await logTimeline(db, {
      customer_id: body.customer_id,
      staff_id: currentUser.id,
      action_type: 'TASK_CREATED',
      title: `Task Created: ${body.task_type || 'Follow-up'}`,
      description: `${currentUser.name} scheduled task due on ${body.due_date}${body.due_time ? ' at ' + body.due_time : ''}: "${body.notes.slice(0, 100)}"`,
      metadata: { task_id: taskId, due_date: body.due_date, priority: body.priority },
    });

    const clientIp = c.req.header('cf-connecting-ip') || '127.0.0.1';
    await logAudit(db, {
      staff_id: currentUser.id,
      staff_name: currentUser.name,
      action: 'CREATE',
      record_type: 'TASK',
      record_id: taskId,
      new_value: { customer_id: body.customer_id, task_type: body.task_type, due_date: body.due_date },
      change_summary: `Created task ${taskId} for ${customer.full_name}`,
      ip_address: clientIp,
    });

    return c.json({
      success: true,
      message: 'Task created successfully.',
      task_id: taskId,
    });
  } catch (err: any) {
    console.error('Create task error:', err);
    return c.json({ success: false, error: 'Failed to create task.' }, 500);
  }
});

// Update task
tasksApp.put('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');
    const taskId = c.req.param('id');
    const body = await c.req.json<Partial<Task>>();

    const existing = await db
      .prepare(`SELECT * FROM tasks WHERE id = ?`)
      .bind(taskId)
      .first<Task>();

    if (!existing) {
      return c.json({ success: false, error: 'Task not found.' }, 404);
    }

    const now = new Date().toISOString();
    let completedAt = existing.completed_at;
    if (body.status === 'Completed' && existing.status !== 'Completed') {
      completedAt = now;
    } else if (body.status && body.status !== 'Completed') {
      completedAt = null;
    }

    await db
      .prepare(
        `UPDATE tasks SET
          esim_id = ?,
          task_type = ?,
          due_date = ?,
          due_time = ?,
          assigned_staff_id = ?,
          priority = ?,
          status = ?,
          notes = ?,
          completed_at = ?,
          updated_at = ?
         WHERE id = ?`
      )
      .bind(
        body.esim_id !== undefined ? body.esim_id : existing.esim_id,
        body.task_type || existing.task_type,
        body.due_date || existing.due_date,
        body.due_time !== undefined ? body.due_time : existing.due_time,
        body.assigned_staff_id !== undefined ? body.assigned_staff_id : existing.assigned_staff_id,
        body.priority || existing.priority,
        body.status || existing.status,
        body.notes || existing.notes,
        completedAt,
        now,
        taskId
      )
      .run();

    if (body.status === 'Completed' && existing.status !== 'Completed') {
      await logTimeline(db, {
        customer_id: existing.customer_id,
        staff_id: currentUser.id,
        action_type: 'TASK_COMPLETED',
        title: `Task Completed: ${existing.task_type}`,
        description: `${currentUser.name} marked task as completed.`,
        metadata: { task_id: taskId },
      });
    }

    const clientIp = c.req.header('cf-connecting-ip') || '127.0.0.1';
    await logAudit(db, {
      staff_id: currentUser.id,
      staff_name: currentUser.name,
      action: 'UPDATE',
      record_type: 'TASK',
      record_id: taskId,
      previous_value: existing,
      new_value: body,
      change_summary: `${currentUser.name} updated task ${taskId} (Status: ${body.status || existing.status})`,
      ip_address: clientIp,
    });

    return c.json({ success: true, message: 'Task updated successfully.' });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to update task.' }, 500);
  }
});

// Delete task
tasksApp.delete('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');
    const taskId = c.req.param('id');

    const existing = await db
      .prepare(`SELECT * FROM tasks WHERE id = ?`)
      .bind(taskId)
      .first<Task>();

    if (!existing) {
      return c.json({ success: false, error: 'Task not found.' }, 404);
    }

    await db.prepare(`DELETE FROM tasks WHERE id = ?`).bind(taskId).run();

    const clientIp = c.req.header('cf-connecting-ip') || '127.0.0.1';
    await logAudit(db, {
      staff_id: currentUser.id,
      staff_name: currentUser.name,
      action: 'DELETE',
      record_type: 'TASK',
      record_id: taskId,
      previous_value: existing,
      change_summary: `${currentUser.name} deleted task ${taskId}`,
      ip_address: clientIp,
    });

    return c.json({ success: true, message: 'Task deleted successfully.' });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to delete task.' }, 500);
  }
});

export default tasksApp;
