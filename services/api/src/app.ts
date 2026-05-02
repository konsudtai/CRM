/**
 * SalesFAST 7 — Unified API (Hono)
 * All routes in a single Lambda function.
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import auth from './routes/auth.js';
import users from './routes/users.js';
import accounts from './routes/accounts.js';
import leads from './routes/leads.js';
import tasks from './routes/tasks.js';
import products from './routes/products.js';
import quotations from './routes/quotations.js';
import opportunities from './routes/opportunities.js';
import dashboard from './routes/dashboard.js';
import notifications from './routes/notifications.js';
import activities from './routes/activities.js';

const app = new Hono();

// CORS
app.use('*', cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['*'],
  credentials: true,
}));

// Health check
app.get('/', (c) => c.json({ service: 'salesfast7-api', status: 'ok' }));
app.get('/health', (c) => c.json({ status: 'ok' }));

// Routes
app.route('/auth', auth);
app.route('/users', users);
app.route('/accounts', accounts);
app.route('/leads', leads);
app.route('/tasks', tasks);
app.route('/products', products);
app.route('/quotations', quotations);
app.route('/opportunities', opportunities);
app.route('/dashboard', dashboard);
app.route('/notifications', notifications);
app.route('/activities', activities);

// 404
app.notFound((c) => c.json({ message: 'Not found' }, 404));

// Error handler
app.onError((err, c) => {
  console.error('API Error:', err.message);
  return c.json({ message: err.message || 'Internal Server Error' }, 500);
});

export default app;
