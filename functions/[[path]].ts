import type { Env } from '../worker/types';

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  if (!url.pathname.startsWith('/api')) {
    return context.next();
  }
  const app = (await import('../worker/index')).default;
  return app.fetch(context.request, context.env, context);
};
