import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env, StaffUser } from './types';
import { dropRetiredTables } from './retired';
import authApp from './routes/auth';
import dashboardApp from './routes/dashboard';
import esimsApp from './routes/esims';
import referralsApp from './routes/referrals';
import staffApp from './routes/staff';
import settingsApp from './routes/settings';
import searchApp from './routes/search';
import yesimApp from './routes/yesim';

const app = new Hono<{ Bindings: Env; Variables: { user: StaffUser } }>();

app.use('/api/*', cors({
  origin: (origin) => origin || '*',
  allowHeaders: ['Content-Type', 'Authorization', 'x-callbite-token'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}));

app.use('/api/*', async (c, next) => {
  try {
    await dropRetiredTables(c.env.DB);
  } catch {
    // ignore
  }
  await next();
});

app.route('/api/auth', authApp);
app.route('/api/dashboard', dashboardApp);
app.route('/api/esims', esimsApp);
app.route('/api/referrals', referralsApp);
app.route('/api/staff', staffApp);
app.route('/api/settings', settingsApp);
app.route('/api/search', searchApp);
app.route('/api/yesim', yesimApp);

app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    system: 'Callbite Esim Staff CRM',
    timestamp: new Date().toISOString(),
  });
});

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
