import { Context, Next } from 'hono';
import { Env, StaffUser } from './types';

export function createToken(userId = 'STF-001'): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  const randomHex = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
  return `tok_${userId}_${randomHex}`;
}

export async function getAuthenticatedUser(c: Context<{ Bindings: Env; Variables: { user: StaffUser } }>): Promise<StaffUser | null> {
  const authHeader = c.req.header('Authorization') || c.req.header('authorization');
  let token: string | null = null;

  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (c.req.header('x-callbite-token')) {
    token = c.req.header('x-callbite-token')!.trim();
  } else {
    const cookie = c.req.header('Cookie') || c.req.header('cookie');
    if (cookie) {
      const match = cookie.match(/callbite_session=([^;]+)/);
      if (match) {
        token = match[1].trim();
      }
    }
  }

  if (!token) return null;

  try {
    // 1. Look up session in D1
    const session = await c.env.DB
      .prepare(
        `SELECT u.id, u.name, u.email, u.role, u.phone, u.status, u.avatar_url, u.created_at, u.updated_at, u.last_login_at
         FROM sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.token = ? AND u.status = 'active'`
      )
      .bind(token)
      .first<StaffUser>();

    if (session) {
      return session;
    }

    // 2. Token format tok_STF-XXX_...
    if (token.startsWith('tok_')) {
      const parts = token.split('_');
      if (parts.length >= 2) {
        const uId = parts[1];
        const user = await c.env.DB
          .prepare(`SELECT id, name, email, role, phone, status, avatar_url, created_at, updated_at, last_login_at FROM users WHERE id = ? AND status = 'active'`)
          .bind(uId)
          .first<StaffUser>();
        if (user) {
          const now = new Date();
          const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
          try {
            await c.env.DB
              .prepare(`INSERT OR REPLACE INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`)
              .bind(token, user.id, expiresAt, now.toISOString())
              .run();
          } catch {}
          return user;
        }
      }
    }

    return null;
  } catch (err) {
    console.error('getAuthenticatedUser error:', err);
    return null;
  }
}

export async function authMiddleware(c: Context<{ Bindings: Env; Variables: { user: StaffUser } }>, next: Next) {
  const user = await getAuthenticatedUser(c);
  if (!user) {
    return c.json({ success: false, error: 'Session expired or unauthorized. Please log in again.' }, 401);
  }
  c.set('user', user);
  await next();
}

export async function adminOnlyMiddleware(c: Context<{ Bindings: Env; Variables: { user: StaffUser } }>, next: Next) {
  const user = c.get('user');
  if (!user || user.role !== 'ADMIN') {
    return c.json({ success: false, error: 'Forbidden: Admin access required.' }, 403);
  }
  await next();
}
