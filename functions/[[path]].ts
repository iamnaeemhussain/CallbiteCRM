import app from '../worker/index';
import { Env } from '../worker/types';

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);

  if (url.pathname.startsWith('/api')) {
    return app.fetch(context.request, context.env, context);
  }

  return context.next();
};
