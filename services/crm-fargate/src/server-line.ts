/**
 * crm-line — LINE OA Webhook Service (Fargate)
 *
 * Handles LINE webhook with state machine chatbot.
 * The LINE webhook endpoint is /line-webhook (matches existing CloudFront route).
 *
 * Port: 3003 (default)
 */
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handleLineWebhook, processLineAsync } from './routes/line-webhook.js';

const app = new Hono();

app.use('*', cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['*'],
  credentials: true,
}));

app.get('/', (c) => c.json({ service: 'crm-line', status: 'ok' }));
app.get('/health', (c) => c.json({ status: 'ok', service: 'crm-line', timestamp: new Date().toISOString() }));

// Main LINE webhook entry — receive event, ack quickly, process async
app.post('/line-webhook', (c) => handleLineWebhook(c));
app.post('/line/webhook', (c) => handleLineWebhook(c));

// Internal endpoint for self-invoke async processing
// (replaces the Lambda self-invoke pattern with HTTP self-call)
app.post('/internal/line-process', async (c) => {
  // Simple shared-secret protection
  const secret = c.req.header('x-internal-secret');
  if (secret !== process.env.INTERNAL_SECRET) {
    return c.json({ message: 'Unauthorized' }, 401);
  }
  const event = await c.req.json();
  // Fire-and-forget; respond immediately
  processLineAsync(event).catch((e: any) => console.error('[crm-line] processAsync error:', e?.message));
  return c.json({ ok: true });
});

app.notFound((c) => c.json({ message: 'Endpoint not found', service: 'crm-line', path: c.req.path }, 400));
app.onError((err, c) => {
  console.error('[crm-line] Error:', err.message);
  return c.json({ message: err.message || 'Internal Server Error' }, 500);
});

const port = parseInt(process.env.PORT || '3003');
console.log(`[crm-line] Starting on port ${port}`);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[crm-line] Listening on http://0.0.0.0:${info.port}`);
});

process.on('SIGTERM', () => {
  console.log('[crm-line] SIGTERM received, shutting down gracefully');
  process.exit(0);
});
