import { Hono } from 'hono';
import { Env, StaffUser } from '../types';
import { authMiddleware, createToken } from '../auth';
import { logAudit } from '../db';
import { memoryStore } from '../embedded-db';

const authApp = new Hono<{ Bindings: Env; Variables: { user: StaffUser } }>();

authApp.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json<{ email?: string; password?: string }>();

    if (!email || !password) {
      return c.json({ success: false, error: 'Please enter both email and password.' }, 400);
    }

    const cleanEmail = email.trim().toLowerCase();
    let user: any = null;

    // 1. Try D1 if connected
    if (c.env && c.env.DB) {
      try {
        user = await c.env.DB
          .prepare(
            `SELECT id, name, email, password, role, phone, status, avatar_url, created_at, updated_at, last_login_at
             FROM users
             WHERE LOWER(email) = LOWER(?)`
          )
          .bind(cleanEmail)
          .first<StaffUser & { password?: string }>();
      } catch (e) {
        console.warn('D1 login lookup notice:', e);
      }
    }

    // 2. Memory store fallback
    if (!user) {
      user = memoryStore.users.find((u) => u.email.toLowerCase() === cleanEmail);
    }

    if (!user) {
      return c.json({ success: false, error: 'Invalid email or password. Please verify credentials.' }, 401);
    }

    if (user.password !== password.trim()) {
      return c.json({ success: false, error: 'Invalid email or password. Please verify credentials.' }, 401);
    }

    if (user.status !== 'active') {
      return c.json({ success: false, error: 'Your staff account has been deactivated. Please contact an administrator.' }, 403);
    }

    const token = createToken(user.id);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const nowIso = now.toISOString();

    // Store in D1
    if (c.env && c.env.DB) {
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
    }

    // Also store in memory
    memoryStore.sessions.push({ token, user_id: user.id, expires_at: expiresAt, created_at: nowIso });

    const { password: _p, ...safeUser } = user;

    c.header('Set-Cookie', `callbite_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);

    return c.json({
      success: true,
      token,
      user: safeUser,
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return c.json({ success: false, error: 'Login failed. Please verify credentials.' }, 500);
  }
});

authApp.post('/logout', authMiddleware, async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      if (c.env && c.env.DB) {
        try {
          await c.env.DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
        } catch {}
      }
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

export default authApp;
