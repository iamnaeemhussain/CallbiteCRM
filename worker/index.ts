import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env, StaffUser } from './types';
import { ensureDbInitialized } from './db';
import { createFallbackD1 } from './fallback-db';
import authApp from './routes/auth';
import dashboardApp from './routes/dashboard';
import customersApp from './routes/customers';
import esimsApp from './routes/esims';
import renewalsApp from './routes/renewals';
import transactionsApp from './routes/transactions';
import supportApp from './routes/support';
import tasksApp from './routes/tasks';
import interactionsApp from './routes/interactions';
import notesApp from './routes/notes';
import referralsApp from './routes/referrals';
import staffApp from './routes/staff';
import auditApp from './routes/audit';
import settingsApp from './routes/settings';
import searchApp from './routes/search';
import providersApp from './routes/providers';
import packagesApp from './routes/packages';

const app = new Hono<{ Bindings: Env; Variables: { user: StaffUser } }>();

const fallbackDb = createFallbackD1();

// CORS & Middleware
app.use('*', cors({
  origin: (origin) => origin || '*',
  allowHeaders: ['Content-Type', 'Authorization', 'x-callbite-token'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}));

// Fallback DB & Auto-Initialize Schema on API Requests
app.use('/api/*', async (c, next) => {
  if (!c.env.DB) {
    (c.env as any).DB = fallbackDb;
  } else {
    try {
      await ensureDbInitialized(c.env.DB);
    } catch {
      (c.env as any).DB = fallbackDb;
    }
  }
  await next();
});

// Mount API sub-routers
app.route('/api/auth', authApp);
app.route('/api/dashboard', dashboardApp);
app.route('/api/customers', customersApp);
app.route('/api/esims', esimsApp);
app.route('/api/renewals', renewalsApp);
app.route('/api/transactions', transactionsApp);
app.route('/api/support', supportApp);
app.route('/api/tasks', tasksApp);
app.route('/api/interactions', interactionsApp);
app.route('/api/notes', notesApp);
app.route('/api/referrals', referralsApp);
app.route('/api/staff', staffApp);
app.route('/api/audit', auditApp);
app.route('/api/settings', settingsApp);
app.route('/api/search', searchApp);
app.route('/api/providers', providersApp);
app.route('/api/packages', packagesApp);

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    system: 'Callbite Customer Management Portal',
    timestamp: new Date().toISOString(),
  });
});

// Fallback for static assets in Cloudflare Workers environment
app.all('*', async (c) => {
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text('Not found', 404);
});

export default app;
