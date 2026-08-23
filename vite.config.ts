import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { createLocalD1 } from './scripts/local-d1';
import workerApp from './worker/index';

function localApiPlugin(): Plugin {
  let localDb: D1Database;

  return {
    name: 'local-api-plugin',
    configureServer(server) {
      localDb = createLocalD1('local.db');

      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api')) {
          return next();
        }

        try {
          const protocol = req.headers['x-forwarded-proto'] || 'http';
          const host = req.headers.host || 'localhost:3000';
          const fullUrl = `${protocol}://${host}${req.url}`;

          // Read body for POST/PUT/DELETE
          let bodyBuffer: Buffer | null = null;
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
            }
            bodyBuffer = Buffer.concat(chunks);
          }

          const webHeaders = new Headers();
          for (const [key, val] of Object.entries(req.headers)) {
            if (val !== undefined) {
              if (Array.isArray(val)) {
                val.forEach((v) => webHeaders.append(key, v));
              } else {
                webHeaders.set(key, val);
              }
            }
          }

          const webReq = new Request(fullUrl, {
            method: req.method,
            headers: webHeaders,
            body: bodyBuffer && bodyBuffer.length > 0 ? bodyBuffer : undefined,
          });

          const env = {
            DB: localDb,
            APP_NAME: 'callbite-crm',
          };

          const webRes = await workerApp.fetch(webReq, env as any);

          res.statusCode = webRes.status;
          webRes.headers.forEach((v, k) => {
            res.setHeader(k, v);
          });

          const resBuffer = await webRes.arrayBuffer();
          res.end(Buffer.from(resBuffer));
        } catch (err: any) {
          console.error('API middleware error:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: 'Internal API Server Error' }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
});
