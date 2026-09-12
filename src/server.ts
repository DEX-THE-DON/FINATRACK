import { serve } from '@hono/node-server';
import { app } from './index';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch (e) {
    // .env might not exist in production or Cloudflare
  }
}

const port = Number(process.env.PORT || 3000);
console.log(`⚡ Finatrack TypeScript Edge Server running at http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
  hostname: '0.0.0.0',
});
