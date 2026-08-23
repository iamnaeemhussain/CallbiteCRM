import { Hono } from 'hono';
import { Env, StaffUser, StaffRole } from '../types';
import { authMiddleware, createToken } from '../auth';
import { logAudit } from '../db';

const authApp = new Hono<{ Bindings: Env; Variables: { user: StaffUser } }>();

const DEFAULT_STAFF: Record<string, { id: string; name: string; role: StaffRole; pass: string; phone: string }> = {
  'admin@callbite.com': { id: 'STF-001', name: 'System Admin', role: 'ADMIN', pass: 'Touch@11223', phone: '+923000000001' },
  'naeem@callbite.com': { id: 'STF-002', name: 'Naeem Hussain', role: 'ADMIN', pass: 'Touch@11223', phone: '+923000000002' },
  'aaa@callbite.com': { id: 'STF-003', name: 'Operations Admin', role: 'ADMIN', pass: 'Touch@786', phone: '+923000000003' },
  'sara.khan@callbite.com': { id: 'STF-004', name: 'Sara Khan', role: 'SUPPORT_STAFF', pass: 'Support@123', phone: '+923011112233' },
  'ali.raza@callbite.com': { id: 'STF-005', name: 'Ali Raza', role: 'SUPPORT_STAFF', pass: 'Support@123', phone: '+923022223344' },
};

authApp.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json<{ email?: string; password?: string }>();

    if (!email || !password) {
      return c.json({ success: false, error: 'Please enter both email and password.' }, 400);
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    let user: any = null;

    // 1. Try DB lookup
    try {
      if (c.env && c.env.DB) {
        user = await c.env.DB
          .prepare(
            `SELECT id, name, email, password, role, phone, status, avatar_url, created_at, updated_at, last_login_at
             FROM users
             WHERE LOWER(email) = LOWER(?)`
          )
          .bind(cleanEmail)
          .first<StaffUser & { password?: string }>();
      }
    } catch (dbErr) {
      console.warn('DB lookup error during login:', dbErr);
    }

    // 2. If user found in DB, check password
    if (user) {
      const dbPassword = (user.password || '').trim();
      if (dbPassword !== cleanPassword && dbPassword !== password) {
        return c.json({ success: false, error: 'Invalid password. Please check your credentials.' }, 401);
      }
      if (user.status !== 'active') {
        return c.json({ success: false, error: 'Your staff account has been deactivated.' }, 403);
      }
    } else {
      // 3. Check pre-configured staff dictionary
      const defaultStaff = DEFAULT_STAFF[cleanEmail];
      if (!defaultStaff || (defaultStaff.pass !== cleanPassword && defaultStaff.pass !== password)) {
        return c.json({ success: false, error: 'Invalid email or password. Please verify credentials.' }, 401);
      }

      user = {
        id: defaultStaff.id,
        name: defaultStaff.name,
        email: cleanEmail,
        role: defaultStaff.role,
        phone: defaultStaff.phone,
        status: 'active',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-08-23T00:00:00Z',
        last_login_at: new Date().toISOString(),
      };

      // Auto-insert into DB if DB is connected
      try {
        if (c.env && c.env.DB) {
          await c.env.DB
            .prepare(
              `INSERT OR REPLACE INTO users (id, name, email, password, role, phone, status, created_at, updated_at, last_login_at)
               VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`
            )
            .bind(user.id, user.name, user.email, defaultStaff.pass, user.role, user.phone, user.created_at, user.updated_at, user.last_login_at)
            .run();
        }
      } catch {}
    }

    const token = createToken(user.id);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const nowIso = now.toISOString();

    try {
      if (c.env && c.env.DB) {
        await c.env.DB
          .prepare(`INSERT OR REPLACE INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`)
          .bind(token, user.id, expiresAt, nowIso)
          .run();

        await c.env.DB
          .prepare(`UPDATE users SET last_login_at = ? WHERE id = ?`)
          .bind(nowIso, user.id)
          .run();
      }
    } catch {}

    const { password: _p, ...safeUser } = user;

    c.header('Set-Cookie', `callbite_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);

    return c.json({
      success: true,
      token,
      user: safeUser,
    });
  } catch (err: any) {
    console.error('Login handler error:', err);
    return c.json({ success: false, error: err.message || 'Login error. Please try again.' }, 500);
  }
});

authApp.post('/logout', authMiddleware, async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      if (c.env && c.env.DB) {
        await c.env.DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
      }
    }
    c.header('Set-Cookie', `callbite_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    return c.json({ success: true, message: 'Logged out successfully.' });
  } catch {
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

    if (c.env && c.env.DB) {
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
    }

    return c.json({
      success: true,
      user: {
        ...currentUser,
        name: name.trim(),
        phone: phone?.trim() || null,
        updated_at: now,
      },
    });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to update profile.' }, 500);
  }
});

export default authApp;
