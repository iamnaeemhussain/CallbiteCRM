import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env, StaffUser } from './types';
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
import yesimApp from './routes/yesim';
import publicReferralsApp from './routes/public-referrals';

const app = new Hono<{ Bindings: Env; Variables: { user: StaffUser } }>();

const PUBLIC_FORM_ORIGINS = new Set([
  'https://pak-tel.com',
  'https://www.pak-tel.com',
  'http://pak-tel.com',
  'http://www.pak-tel.com',
]);

function publicFormCorsHeaders(origin?: string | null): Record<string, string> {
  const allowOrigin = origin && PUBLIC_FORM_ORIGINS.has(origin) ? origin : 'https://pak-tel.com';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

// Public referral ingest CORS + preflight MUST run before staff auth and SPA fallback.
app.on(['OPTIONS'], '/api/public/referral-requests', (c) => {
  return new Response(null, { status: 204, headers: publicFormCorsHeaders(c.req.header('Origin')) });
});
app.on(['OPTIONS'], '/api/public/referral-requests/*', (c) => {
  return new Response(null, { status: 204, headers: publicFormCorsHeaders(c.req.header('Origin')) });
});

app.use('/api/public/*', async (c, next) => {
  await next();
  const headers = publicFormCorsHeaders(c.req.header('Origin'));
  Object.entries(headers).forEach(([k, v]) => c.header(k, v));
});

app.route('/api/public/referral-requests', publicReferralsApp);

// Staff CRM CORS
app.use('/api/*', cors({
  origin: (origin) => origin || '*',
  allowHeaders: ['Content-Type', 'Authorization', 'x-callbite-token', 'x-paktel-form-key'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}));

// Mount authenticated API sub-routers
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
app.route('/api/yesim', yesimApp);

app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    system: 'Callbite Customer Management Portal',
    timestamp: new Date().toISOString(),
  });
});

// Never serve the React SPA for API paths (that was redirecting public POSTs to /login).
app.all('/api/*', (c) => {
  return c.json({ success: false, error: 'API route not found.' }, 404);
});

app.all('*', async (c) => {
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text('Not found', 404);
});

export default app;
