import type { Env } from '../worker/types';

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);

  if (!url.pathname.startsWith('/api')) {
    return context.next();
  }

  if (url.pathname === '/api/public/referral-requests' || url.pathname.startsWith('/api/public/referral-requests/')) {
    const pub = await import('./api/public/referral-requests');
    const method = context.request.method.toUpperCase();
    if (method === 'OPTIONS') return pub.onRequestOptions(context);
    if (method === 'GET') return pub.onRequestGet(context);
    if (method === 'POST') return pub.onRequestPost(context);
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed.' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const app = (await import('../worker/index')).default;
  return app.fetch(context.request, context.env, context);
};
