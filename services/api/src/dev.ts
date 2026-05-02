/**
 * Local development server.
 * Run: npx tsx src/dev.ts
 */
import { serve } from '@hono/node-server';
import app from './app.js';

const port = parseInt(process.env.PORT || '3001');
console.log(`SalesFAST 7 API running on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
