import { Hono } from 'hono';
import { Env, StaffUser, CustomerNote } from '../types';
import { authMiddleware } from '../auth';
import { logTimeline, logAudit } from '../db';

const notesApp = new Hono<{ Bindings: Env; Variables: { user: StaffUser } }>();

notesApp.use('*', authMiddleware);

// Get notes for customer
notesApp.get('/', async (c) => {
  try {
    const db = c.env.DB;
    const { customer_id } = c.req.query();

    if (!customer_id) {
      return c.json({ success: false, error: 'Customer ID required.' }, 400);
    }

    const notes = await db
      .prepare(
        `SELECT n.*, u.name AS staff_name
         FROM notes n
         LEFT JOIN users u ON n.staff_id = u.id
         WHERE n.customer_id = ?
         ORDER BY n.is_pinned DESC, n.created_at DESC`
      )
      .bind(customer_id)
      .all<any>();

    return c.json({ success: true, notes: notes.results || [] });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to fetch notes.' }, 500);
  }
});

// Create note
notesApp.post('/', async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');
    const body = await c.req.json<{
      customer_id: string;
      title?: string;
      content: string;
      is_pinned?: boolean | number;
    }>();

    if (!body.customer_id || !body.content || !body.content.trim()) {
      return c.json({ success: false, error: 'Customer ID and content are required.' }, 400);
    }

    const now = new Date().toISOString();
    const isPinned = body.is_pinned ? 1 : 0;

    const res = await db
      .prepare(
        `INSERT INTO notes (customer_id, staff_id, title, content, is_pinned, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        body.customer_id,
        currentUser.id,
        body.title?.trim() || null,
        body.content.trim(),
        isPinned,
        now,
        now
      )
      .run();

    await logTimeline(db, {
      customer_id: body.customer_id,
      staff_id: currentUser.id,
      action_type: 'NOTE_ADDED',
      title: `Internal Note Added${body.title ? ': ' + body.title : ''}`,
      description: `${currentUser.name} added internal note: "${body.content.slice(0, 100)}"`,
    });

    return c.json({
      success: true,
      message: 'Note created successfully.',
      note_id: res.meta?.last_row_id,
    });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to add note.' }, 500);
  }
});

// Update note (e.g. toggle pin or edit text)
notesApp.put('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const noteId = c.req.param('id');
    const body = await c.req.json<{
      title?: string;
      content?: string;
      is_pinned?: boolean | number;
    }>();

    const existing = await db.prepare(`SELECT * FROM notes WHERE id = ?`).bind(noteId).first<CustomerNote>();
    if (!existing) {
      return c.json({ success: false, error: 'Note not found.' }, 404);
    }

    const now = new Date().toISOString();
    const isPinned = body.is_pinned !== undefined ? (body.is_pinned ? 1 : 0) : existing.is_pinned;

    await db
      .prepare(`UPDATE notes SET title = ?, content = ?, is_pinned = ?, updated_at = ? WHERE id = ?`)
      .bind(
        body.title !== undefined ? body.title : existing.title,
        body.content !== undefined ? body.content.trim() : existing.content,
        isPinned,
        now,
        noteId
      )
      .run();

    return c.json({ success: true, message: 'Note updated successfully.' });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to update note.' }, 500);
  }
});

// Delete note
notesApp.delete('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const noteId = c.req.param('id');
    await db.prepare(`DELETE FROM notes WHERE id = ?`).bind(noteId).run();
    return c.json({ success: true, message: 'Note deleted successfully.' });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to delete note.' }, 500);
  }
});

export default notesApp;
