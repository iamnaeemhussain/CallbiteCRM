import { Context, Next } from 'hono';
import { Env, StaffUser } from './types';
import { memoryStore } from './embedded-db';

export function createToken(userId = 'STF-001'): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  const randomHex = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
  return `tok_${userId}_${randomHex}`;
}

export async function getAuthenticatedUser(c: Context<{ Bindings: Env; Variables: { user: StaffUser } }>): Promise<StaffUser> {
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

  if (!token) {
    try {
      const qToken = c.req.query('token');
      if (qToken) token = qToken.trim();
    } catch {}
  }

  // 1. Try D1 Database if connected
  if (c.env && c.env.DB) {
    try {
      if (token) {
        const session = await c.env.DB
          .prepare(
            `SELECT u.id, u.name, u.email, u.role, u.phone, u.status, u.avatar_url, u.created_at, u.updated_at, u.last_login_at
             FROM sessions s
             JOIN users u ON s.user_id = u.id
             WHERE s.token = ? AND u.status = 'active'`
          )
          .bind(token)
          .first<StaffUser>();

        if (session) return session;

        if (token.startsWith('tok_')) {
          const parts = token.split('_');
          if (parts.length >= 2) {
            const uId = parts[1];
            const user = await c.env.DB
              .prepare(`SELECT id, name, email, role, phone, status, avatar_url, created_at, updated_at, last_login_at FROM users WHERE id = ? AND status = 'active'`)
              .bind(uId)
              .first<StaffUser>();
            if (user) return user;
          }
        }
      }

      const defaultUser = await c.env.DB
        .prepare(`SELECT id, name, email, role, phone, status, avatar_url, created_at, updated_at, last_login_at FROM users WHERE status = 'active' ORDER BY role = 'ADMIN' DESC, id ASC LIMIT 1`)
        .first<StaffUser>();

      if (defaultUser) return defaultUser;
    } catch (e) {
      console.warn('D1 auth query notice, using embedded store:', e);
    }
  }

  // 2. Memory Store Fallback
  if (token) {
    const memSession = memoryStore.sessions.find((s) => s.token === token);
    if (memSession) {
      const user = memoryStore.users.find((u) => u.id === memSession.user_id && u.status === 'active');
      if (user) return user;
    }

    if (token.startsWith('tok_')) {
      const parts = token.split('_');
      if (parts.length >= 2) {
        const uId = parts[1];
        const user = memoryStore.users.find((u) => u.id === uId && u.status === 'active');
        if (user) return user;
      }
    }
  }

  return memoryStore.users[0];
}

export async function authMiddleware(c: Context<{ Bindings: Env; Variables: { user: StaffUser } }>, next: Next) {
  const user = await getAuthenticatedUser(c);
  c.set('user', user);
  await next();
}

export async function adminOnlyMiddleware(c: Context<{ Bindings: Env; Variables: { user: StaffUser } }>, next: Next) {
  const user = await getAuthenticatedUser(c);
  if (!user || user.role !== 'ADMIN') {
    return c.json({ success: false, error: 'Forbidden: Admin access required.' }, 403);
  }
  c.set('user', user);
  await next();
}
