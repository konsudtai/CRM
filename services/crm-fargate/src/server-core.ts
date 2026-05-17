/**
 * crm-core — Core CRM HTTP Server (Fargate)
 *
 * Routes: auth, users, roles, accounts, leads, tasks, dashboard, agents (proxy),
 *         notifications, activities, settings
 *
 * Port: 3001 (default)
 */
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import auth from './routes/auth.js';
import users from './routes/users.js';
import roles from './routes/roles.js';
import accounts from './routes/accounts.js';
import leads from './routes/leads.js';
import tasks from './routes/tasks.js';
import dashboard from './routes/dashboard.js';
import notifications from './routes/notifications.js';
import activities from './routes/activities.js';
import agents from './routes/agents.js';
import settings from './routes/settings.js';

const app = new Hono();

app.use('*', cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['*'],
  credentials: true,
}));

app.get('/', (c) => c.json({ service: 'crm-core', status: 'ok' }));
app.get('/health', (c) => c.json({ status: 'ok', service: 'crm-core', timestamp: new Date().toISOString() }));

app.route('/auth', auth);
app.route('/users', users);
app.route('/roles', roles);
app.route('/accounts', accounts);
app.route('/leads', leads);
app.route('/tasks', tasks);
app.route('/dashboard', dashboard);
app.route('/dashboard/settings', settings);
app.route('/notifications', notifications);
app.route('/activities', activities);
app.route('/agents', agents);
app.route('/settings', settings);

app.notFound((c) => c.json({ message: 'Endpoint not found', service: 'crm-core', path: c.req.path }, 400));
app.onError((err, c) => {
  console.error('[crm-core] Error:', err.message);
  return c.json({ message: err.message || 'Internal Server Error' }, 500);
});

const port = parseInt(process.env.PORT || '3001');
console.log(`[crm-core] Starting on port ${port}`);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[crm-core] Listening on http://0.0.0.0:${info.port}`);
});

// Graceful shutdown for ECS
process.on('SIGTERM', () => {
  console.log('[crm-core] SIGTERM received, shutting down gracefully');
  process.exit(0);
});
