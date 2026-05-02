import { Hono } from 'hono';
import { query, transaction } from '../lib/db.js';
import { authMiddleware } from '../lib/auth.js';

const quotations = new Hono();
quotations.use('*', authMiddleware);

quotations.get('/', async (c) => {
  const t = c.get('tenantId');
  const status = c.req.query('status');
  const limit = parseInt(c.req.query('limit') || '50');
  let where = 'q.tenant_id = $1';
  const params: any[] = [t];
  if (status) { where += ` AND q.status = $2`; params.push(status); }
  params.push(limit);
  const r = await query(t,
    `SELECT q.*, a.company_name as account_name FROM quotations q
     LEFT JOIN accounts a ON a.id = q.account_id
     WHERE ${where} ORDER BY q.created_at DESC LIMIT $${params.length}`, params);
  return c.json(r.rows);
});

quotations.get('/:id', async (c) => {
  const t = c.get('tenantId');
  const id = c.req.param('id');
  const qr = await query(t, `SELECT q.*, a.company_name as account_name FROM quotations q LEFT JOIN accounts a ON a.id = q.account_id WHERE q.id = $1`, [id]);
  if (qr.rows.length === 0) return c.json({ message: 'Not found' }, 404);
  const items = await query(t, 'SELECT * FROM quotation_line_items WHERE quotation_id = $1', [id]);
  return c.json({ ...qr.rows[0], lineItems: items.rows });
});

quotations.post('/', async (c) => {
  const t = c.get('tenantId');
  const userId = c.get('userId');
  const b = await c.req.json().catch(() => ({}));
  if (!b.accountId || !b.lineItems?.length) return c.json({ message: 'accountId and lineItems required' }, 400);

  return await transaction(t, async (client) => {
    // Get next QT number
    const year = new Date().getFullYear();
    const seqR = await client.query(
      `INSERT INTO quotation_sequences (tenant_id, prefix, year, current_value)
       VALUES ($1, 'QT', $2, 1)
       ON CONFLICT (tenant_id, prefix, year) DO UPDATE SET current_value = quotation_sequences.current_value + 1
       RETURNING current_value`, [t, year]);
    const num = `QT-${year}-${String(seqR.rows[0].current_value).padStart(4, '0')}`;

    // Calculate totals
    let subtotal = 0;
    let whtAmount = 0;
    for (const li of b.lineItems) {
      const lineTotal = li.quantity * li.unitPrice - (li.discount || 0);
      subtotal += lineTotal;
      whtAmount += lineTotal * ((li.whtRate || 0) / 100);
    }
    const totalDiscount = b.totalDiscount || 0;
    const afterDiscount = subtotal - totalDiscount;
    const vatAmount = Math.round(afterDiscount * 0.07 * 100) / 100;
    const grandTotal = Math.round((afterDiscount + vatAmount - whtAmount) * 100) / 100;

    // Insert quotation
    const qr = await client.query(
      `INSERT INTO quotations (tenant_id, quotation_number, account_id, contact_id, subtotal, total_discount, vat_amount, wht_amount, grand_total, status, created_by, valid_until)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft',$10,$11) RETURNING *`,
      [t, num, b.accountId, b.contactId||null, subtotal, totalDiscount, vatAmount, whtAmount, grandTotal, userId, b.validUntil||null]);

    const qtId = qr.rows[0].id;

    // Insert line items
    for (const li of b.lineItems) {
      const lineTotal = li.quantity * li.unitPrice - (li.discount || 0);
      await client.query(
        `INSERT INTO quotation_line_items (quotation_id, product_id, product_name, sku, quantity, unit_price, discount, wht_rate, line_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [qtId, li.productId, li.productName||'', li.sku||'', li.quantity, li.unitPrice, li.discount||0, li.whtRate||0, lineTotal]);
    }

    return c.json(qr.rows[0], 201);
  });
});

// ── Approve ──
quotations.post('/:id/approve', async (c) => {
  const t = c.get('tenantId');
  const userId = c.get('userId');
  const r = await query(t,
    `UPDATE quotations SET status = 'sent', approved_by = $1, updated_at = NOW() WHERE id = $2 AND status IN ('draft','pending_approval') RETURNING *`,
    [userId, c.req.param('id')]);
  if (r.rows.length === 0) return c.json({ message: 'Not found or already processed' }, 404);
  return c.json(r.rows[0]);
});

// ── Reject ──
quotations.post('/:id/reject', async (c) => {
  const t = c.get('tenantId');
  const r = await query(t,
    `UPDATE quotations SET status = 'rejected', updated_at = NOW() WHERE id = $1 AND status IN ('draft','pending_approval') RETURNING *`,
    [c.req.param('id')]);
  return c.json(r.rows[0] || { message: 'Not found' });
});

export default quotations;
