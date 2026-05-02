/**
 * Account (Customer) routes — CRUD, search, contacts, tags.
 */
import { Hono } from 'hono';
import { query } from '../lib/db.js';
import { authMiddleware } from '../lib/auth.js';

const accounts = new Hono();
accounts.use('*', authMiddleware);

// ── GET /accounts ──
accounts.get('/', async (c) => {
  const t = c.get('tenantId');
  const search = c.req.query('search') || '';
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = (page - 1) * limit;

  let where = 'a.tenant_id = $1 AND a.deleted_at IS NULL';
  const params: any[] = [t];

  if (search) {
    where += ` AND (a.company_name ILIKE $2 OR a.company_name_en ILIKE $2 OR a.tax_id ILIKE $2 OR a.email ILIKE $2 OR a.phone ILIKE $2)`;
    params.push(`%${search}%`);
  }

  const countR = await query(t, `SELECT count(*) FROM accounts a WHERE ${where}`, params);
  const total = parseInt(countR.rows[0].count);

  params.push(limit, offset);
  const dataR = await query(t,
    `SELECT a.*, (SELECT array_agg(t.name) FROM tags t JOIN account_tags at ON at.tag_id = t.id WHERE at.account_id = a.id) as tags
     FROM accounts a WHERE ${where} ORDER BY a.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return c.json({ data: dataR.rows, total, page, limit });
});

// ── GET /accounts/:id ──
accounts.get('/:id', async (c) => {
  const t = c.get('tenantId');
  const id = c.req.param('id');

  const r = await query(t, `SELECT a.* FROM accounts a WHERE a.id = $1 AND a.deleted_at IS NULL`, [id]);
  if (r.rows.length === 0) return c.json({ message: 'Account not found' }, 404);

  // Get contacts
  const contacts = await query(t, 'SELECT * FROM contacts WHERE account_id = $1 ORDER BY is_primary DESC, created_at', [id]);
  // Get tags
  const tags = await query(t, 'SELECT t.* FROM tags t JOIN account_tags at ON at.tag_id = t.id WHERE at.account_id = $1', [id]);

  return c.json({ ...r.rows[0], contacts: contacts.rows, tags: tags.rows });
});

// ── POST /accounts ──
accounts.post('/', async (c) => {
  const t = c.get('tenantId');
  const userId = c.get('userId');
  const b = await c.req.json().catch(() => ({}));

  if (!b.companyName) return c.json({ message: 'companyName is required' }, 400);

  const r = await query(t,
    `INSERT INTO accounts (tenant_id, company_name, company_name_en, company_type, industry, business_desc,
      tax_id, branch_code, branch_name, phone, phone2, fax, email, website, line_oa_id,
      address, sub_district, district, province, postal_code,
      account_source, account_tier, credit_term, credit_limit, payment_method,
      internal_notes, custom_fields, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
     RETURNING *`,
    [t, b.companyName, b.companyNameEn||null, b.companyType||null, b.industry||null, b.businessDesc||null,
     b.taxId||null, b.branchCode||'00000', b.branchName||null, b.phone||null, b.phone2||null, b.fax||null,
     b.email||null, b.website||null, b.lineOaId||null, b.address||null, b.subDistrict||null, b.district||null,
     b.province||null, b.postalCode||null, b.accountSource||null, b.accountTier||'standard',
     b.creditTerm||30, b.creditLimit||null, b.paymentMethod||null, b.internalNotes||null, b.customFields||'{}', userId]
  );
  return c.json(r.rows[0], 201);
});

// ── PATCH /accounts/:id ──
accounts.patch('/:id', async (c) => {
  const t = c.get('tenantId');
  const id = c.req.param('id');
  const b = await c.req.json().catch(() => ({}));

  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  for (const [key, val] of Object.entries(b)) {
    const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    fields.push(`${col} = $${idx}`);
    values.push(val);
    idx++;
  }
  if (fields.length === 0) return c.json({ message: 'No fields to update' }, 400);

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const r = await query(t, `UPDATE accounts SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
  if (r.rows.length === 0) return c.json({ message: 'Account not found' }, 404);
  return c.json(r.rows[0]);
});

// ── DELETE /accounts/:id (soft delete) ──
accounts.delete('/:id', async (c) => {
  const t = c.get('tenantId');
  await query(t, 'UPDATE accounts SET deleted_at = NOW() WHERE id = $1', [c.req.param('id')]);
  return c.json({ message: 'Deleted' });
});

// ── Contacts sub-routes ──
accounts.get('/:id/contacts', async (c) => {
  const t = c.get('tenantId');
  const r = await query(t, 'SELECT * FROM contacts WHERE account_id = $1 ORDER BY is_primary DESC, created_at', [c.req.param('id')]);
  return c.json(r.rows);
});

accounts.post('/:id/contacts', async (c) => {
  const t = c.get('tenantId');
  const b = await c.req.json().catch(() => ({}));
  if (!b.firstName || !b.lastName) return c.json({ message: 'firstName and lastName required' }, 400);

  const r = await query(t,
    `INSERT INTO contacts (tenant_id, account_id, first_name, last_name, title, phone, email, line_id, custom_fields)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [t, c.req.param('id'), b.firstName, b.lastName, b.title||null, b.phone||null, b.email||null, b.lineId||null, b.customFields||'{}']
  );
  return c.json(r.rows[0], 201);
});

// ── Tags ──
accounts.post('/:id/tags', async (c) => {
  const t = c.get('tenantId');
  const b = await c.req.json().catch(() => ({}));
  if (!b.name) return c.json({ message: 'name required' }, 400);

  // Create or find tag
  let tagR = await query(t, 'SELECT id FROM tags WHERE tenant_id = $1 AND name = $2', [t, b.name]);
  let tagId: string;
  if (tagR.rows.length === 0) {
    tagR = await query(t, 'INSERT INTO tags (tenant_id, name, color) VALUES ($1,$2,$3) RETURNING id', [t, b.name, b.color||'#0176D3']);
    tagId = tagR.rows[0].id;
  } else {
    tagId = tagR.rows[0].id;
  }

  await query(t, 'INSERT INTO account_tags (account_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [c.req.param('id'), tagId]);
  return c.json({ message: 'Tag added' });
});

// ── Activities ──
accounts.get('/:id/activities', async (c) => {
  const t = c.get('tenantId');
  const limit = parseInt(c.req.query('limit') || '20');
  const r = await query(t,
    `SELECT * FROM activities WHERE entity_type = 'account' AND entity_id = $1 ORDER BY timestamp DESC LIMIT $2`,
    [c.req.param('id'), limit]
  );
  return c.json(r.rows);
});

export default accounts;
