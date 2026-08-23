import { Hono } from 'hono';
import { Env, StaffUser } from '../types';
import { authMiddleware, createToken } from '../auth';
import { logAudit } from '../db';

const authApp = new Hono<{ Bindings: Env; Variables: { user: StaffUser } }>();

authApp.post('/login', async (c) => {
  try {
    if (!c.env || !c.env.DB) {
      return c.json({
        success: false,
        error: 'Cloudflare D1 Database binding "DB" is not connected. Please create the D1 database in your Cloudflare dashboard and bind it under Settings -> Bindings.',
      }, 500);
    }

    const { email, password } = await c.req.json<{ email?: string; password?: string }>();

    if (!email || !password) {
      return c.json({ success: false, error: 'Please enter both email and password.' }, 400);
    }

    const cleanEmail = email.trim();
    const user = await c.env.DB
      .prepare(
        `SELECT id, name, email, password, role, phone, status, avatar_url, created_at, updated_at, last_login_at
         FROM users
         WHERE LOWER(email) = LOWER(?)`
      )
      .bind(cleanEmail)
      .first<StaffUser & { password?: string }>();

    if (!user) {
      return c.json({ success: false, error: 'Invalid email or password. Please verify credentials.' }, 401);
    }

    if (user.password !== password) {
      return c.json({ success: false, error: 'Invalid email or password. Please verify credentials.' }, 401);
    }

    if (user.status !== 'active') {
      return c.json({ success: false, error: 'Your staff account has been deactivated. Please contact an administrator.' }, 403);
    }

    const token = createToken(user.id);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const nowIso = now.toISOString();

    try {
      await c.env.DB
        .prepare(`INSERT OR REPLACE INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`)
        .bind(token, user.id, expiresAt, nowIso)
        .run();

      await c.env.DB
        .prepare(`UPDATE users SET last_login_at = ? WHERE id = ?`)
        .bind(nowIso, user.id)
        .run();

      const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '127.0.0.1';
      await logAudit(c.env.DB, {
        staff_id: user.id,
        staff_name: user.name,
        action: 'LOGIN',
        record_type: 'STAFF',
        record_id: user.id,
        change_summary: `${user.name} logged into staff portal`,
        ip_address: clientIp,
      });
    } catch {}

    const { password: _p, ...safeUser } = user;

    c.header('Set-Cookie', `callbite_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);

    return c.json({
      success: true,
      token,
      user: safeUser,
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return c.json({ success: false, error: err.message || 'An unexpected error occurred during login. Please try again.' }, 500);
  }
});

authApp.post('/logout', authMiddleware, async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      await c.env.DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
    }
    c.header('Set-Cookie', `callbite_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    return c.json({ success: true, message: 'Logged out successfully.' });
  } catch (err: any) {
    return c.json({ success: true });
  }
});

authApp.get('/me', authMiddleware, async (c) => {
  const user = c.get('user');
  return c.json({ success: true, user });
});

authApp.post('/update-profile', authMiddleware, async (c) => {
  try {
    const currentUser = c.get('user');
    const { name, phone, password, avatar_url } = await c.req.json<{
      name?: string;
      phone?: string;
      password?: string;
      avatar_url?: string;
    }>();

    if (!name || name.trim().length < 2) {
      return c.json({ success: false, error: 'Name must be at least 2 characters.' }, 400);
    }

    if (password && password.length < 8) {
      return c.json({ success: false, error: 'New password must be at least 8 characters long.' }, 400);
    }

    const now = new Date().toISOString();

    if (password) {
      await c.env.DB
        .prepare(`UPDATE users SET name = ?, phone = ?, password = ?, avatar_url = ?, updated_at = ? WHERE id = ?`)
        .bind(name.trim(), phone?.trim() || null, password, avatar_url || currentUser.avatar_url || null, now, currentUser.id)
        .run();
    } else {
      await c.env.DB
        .prepare(`UPDATE users SET name = ?, phone = ?, avatar_url = ?, updated_at = ? WHERE id = ?`)
        .bind(name.trim(), phone?.trim() || null, avatar_url || currentUser.avatar_url || null, now, currentUser.id)
        .run();
    }

    const updated = await c.env.DB
      .prepare(`SELECT id, name, email, role, phone, status, avatar_url, created_at, updated_at, last_login_at FROM users WHERE id = ?`)
      .bind(currentUser.id)
      .first<StaffUser>();

    return c.json({ success: true, user: updated });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to update profile.' }, 500);
  }
});

export default authApp;
