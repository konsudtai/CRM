/**
 * crm-quotation — Quotation Service (Fargate)
 *
 * Routes: quotations, products, opportunities
 *
 * Port: 3002 (default)
 */
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import quotations from './routes/quotations.js';
import products from './routes/products.js';
import opportunities from './routes/opportunities.js';

const app = new Hono();

app.use('*', cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['*'],
  credentials: true,
}));

app.get('/', (c) => c.json({ service: 'crm-quotation', status: 'ok' }));
app.get('/health', (c) => c.json({ status: 'ok', service: 'crm-quotation', timestamp: new Date().toISOString() }));

app.route('/quotations', quotations);
app.route('/products', products);
app.route('/opportunities', opportunities);

app.notFound((c) => c.json({ message: 'Endpoint not found', service: 'crm-quotation', path: c.req.path }, 400));
app.onError((err, c) => {
  console.error('[crm-quotation] Error:', err.message);
  return c.json({ message: err.message || 'Internal Server Error' }, 500);
});

const port = parseInt(process.env.PORT || '3002');
console.log(`[crm-quotation] Starting on port ${port}`);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[crm-quotation] Listening on http://0.0.0.0:${info.port}`);
});

process.on('SIGTERM', () => {
  console.log('[crm-quotation] SIGTERM received, shutting down gracefully');
  process.exit(0);
});
