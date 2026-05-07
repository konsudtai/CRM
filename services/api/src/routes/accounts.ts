import { Hono } from 'hono';
import { query } from '../lib/db.js';
import { authMiddleware, type TokenPayload } from '../lib/auth.js';

const accounts = new Hono();
accounts.use('*', authMiddleware);

function canEdit(u: TokenPayload, cb: string) {
  return u.sub === cb || u.roles.includes('Admin') || u.roles.includes('Sales Manager');
}

// ── GET /accounts ──
accounts.get('/', async (c) => {
  const t = c.get('tenantId') as string;
  const s = c.req.query('search') || '';
  const lim = parseInt(c.req.query('limit') || '20');
  const pg = parseInt(c.req.query('page') || '1');

  let w = 'a.tenant_id = $1 AND a.deleted_at IS NULL';
  const p: any[] = [t];
  let idx = 2;

  if (s) {
    w += ` AND (a.company_name ILIKE $${idx} OR a.tax_id ILIKE $${idx} OR a.phone ILIKE $${idx} OR a.customer_code ILIKE $${idx})`;
    p.push('%' + s + '%');
    idx++;
  }

  const cnt = await query(t, `SELECT count(*) FROM accounts a WHERE ${w}`, p);
  const dataParams = [...p, lim, (pg - 1) * lim];
  const d = await query(t,
    `SELECT a.*, (SELECT array_agg(tg.name) FROM tags tg JOIN account_tags at2 ON at2.tag_id=tg.id WHERE at2.account_id=a.id) as tags
     FROM accounts a WHERE ${w} ORDER BY a.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
    dataParams);

  return c.json({ data: d.rows, total: parseInt(cnt.rows[0].count), page: pg, limit: lim });
});

// ── GET /accounts/:id ──
accounts.get('/:id', async (c) => {
  const t = c.get('tenantId') as string;
  const id = c.req.param('id');
  const r = await query(t,
    "SELECT a.*, u.first_name || ' ' || u.last_name as created_by_name FROM accounts a LEFT JOIN users u ON u.id = a.created_by WHERE a.id = $1 AND a.deleted_at IS NULL",
    [id]);
  if (!r.rows.length) return c.json({ message: 'Account not found' }, 404);
  const contacts = await query(t, 'SELECT * FROM contacts WHERE account_id = $1 ORDER BY is_primary DESC, created_at', [id]);
  const tags = await query(t, 'SELECT t.* FROM tags t JOIN account_tags at2 ON at2.tag_id=t.id WHERE at2.account_id=$1', [id]);
  return c.json({ ...r.rows[0], contacts: contacts.rows, tags: tags.rows });
});

// ── POST /accounts ──
accounts.post('/', async (c) => {
  const t = c.get('tenantId') as string;
  const uid = c.get('userId') as string;
  const b = await c.req.json().catch(() => ({} as any));
  if (!b.companyName) return c.json({ message: 'companyName required' }, 400);

  // Generate customer_code: C-0001, C-0002, etc.
  await query(t, "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS customer_code VARCHAR(20)", []).catch(() => {});
  const seqR = await query(t,
    "SELECT COALESCE(MAX(CAST(SUBSTRING(customer_code FROM 3) AS INTEGER)), 0) + 1 as next_val FROM accounts WHERE tenant_id = $1 AND customer_code IS NOT NULL",
    [t]);
  const nextVal = seqR.rows[0]?.next_val || 1;
  const customerCode = 'C-' + String(nextVal).padStart(4, '0');

  const r = await query(t,
    `INSERT INTO accounts (tenant_id,customer_code,company_name,company_name_en,company_type,industry,tax_id,branch_code,phone,email,website,address,sub_district,district,province,postal_code,account_source,account_tier,credit_term,internal_notes,custom_fields,created_by,account_owner)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$22) RETURNING *`,
    [t, customerCode, b.companyName, b.companyNameEn||null, b.companyType||null, b.industry||null, b.taxId||null, b.branchCode||'00000',
     b.phone||null, b.email||null, b.website||null, b.address||null, b.subDistrict||null, b.district||null, b.province||null, b.postalCode||null,
     b.accountSource||null, b.accountTier||'standard', b.creditTerm||30, b.internalNotes||null, b.customFields||'{}', uid]);

  return c.json(r.rows[0], 201);
});

// ── PATCH /accounts/:id ──
accounts.patch('/:id', async (c) => {
  const t = c.get('tenantId') as string;
  const u = c.get('user') as TokenPayload;
  const id = c.req.param('id');
  const b = await c.req.json().catch(() => ({} as any));

  const chk = await query(t, 'SELECT created_by FROM accounts WHERE id=$1 AND deleted_at IS NULL', [id]);
  if (!chk.rows.length) return c.json({ message: 'Not found' }, 404);
  if (!canEdit(u, chk.rows[0].created_by)) return c.json({ message: 'Only creator or Admin/Manager can edit' }, 403);

  const map: Record<string, string> = {
    companyName: 'company_name', companyNameEn: 'company_name_en', companyType: 'company_type',
    industry: 'industry', taxId: 'tax_id', phone: 'phone', email: 'email', website: 'website',
    address: 'address', subDistrict: 'sub_district', district: 'district', province: 'province',
    postalCode: 'postal_code', accountTier: 'account_tier', accountStatus: 'account_status',
    internalNotes: 'internal_notes', creditTerm: 'credit_term',
  };

  const s: string[] = [];
  const v: any[] = [];
  let i = 1;
  for (const [k, val] of Object.entries(b)) {
    const col = map[k];
    if (!col) continue;
    s.push(`${col}=$${i}`);
    v.push(val);
    i++;
  }
  if (!s.length) return c.json({ message: 'No fields' }, 400);

  s.push('updated_at=NOW()');
  v.push(id);
  const r = await query(t, `UPDATE accounts SET ${s.join(',')} WHERE id=$${i} RETURNING *`, v);
  return c.json(r.rows[0]);
});

// ── DELETE /accounts/:id ──
accounts.delete('/:id', async (c) => {
  const t = c.get('tenantId') as string;
  const u = c.get('user') as TokenPayload;
  const id = c.req.param('id');

  const chk = await query(t, 'SELECT created_by FROM accounts WHERE id=$1 AND deleted_at IS NULL', [id]);
  if (!chk.rows.length) return c.json({ message: 'Not found' }, 404);
  if (!canEdit(u, chk.rows[0].created_by)) return c.json({ message: 'Only creator or Admin/Manager can delete' }, 403);

  await query(t, 'UPDATE accounts SET deleted_at=NOW() WHERE id=$1', [id]);
  return c.json({ message: 'Deleted' });
});

// ── GET /accounts/:id/contacts ──
accounts.get('/:id/contacts', async (c) => {
  const t = c.get('tenantId') as string;
  return c.json((await query(t, 'SELECT * FROM contacts WHERE account_id=$1 ORDER BY is_primary DESC,created_at', [c.req.param('id')])).rows);
});

// ── POST /accounts/:id/contacts ──
accounts.post('/:id/contacts', async (c) => {
  const t = c.get('tenantId') as string;
  const b = await c.req.json().catch(() => ({} as any));
  if (!b.firstName) return c.json({ message: 'firstName required' }, 400);
  const r = await query(t,
    `INSERT INTO contacts (tenant_id,account_id,first_name,last_name,title,phone,email,line_id,custom_fields)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [t, c.req.param('id'), b.firstName, b.lastName||'', b.title||null, b.phone||null, b.email||null, b.lineId||null, b.customFields||'{}']);
  return c.json(r.rows[0], 201);
});

// ── POST /accounts/:id/tags ──
accounts.post('/:id/tags', async (c) => {
  const t = c.get('tenantId') as string;
  const b = await c.req.json().catch(() => ({} as any));
  if (!b.name) return c.json({ message: 'name required' }, 400);
  let tr = await query(t, 'SELECT id FROM tags WHERE tenant_id=$1 AND name=$2', [t, b.name]);
  let tid: string;
  if (!tr.rows.length) {
    tr = await query(t, 'INSERT INTO tags (tenant_id,name,color) VALUES ($1,$2,$3) RETURNING id', [t, b.name, b.color||'#0176D3']);
    tid = tr.rows[0].id;
  } else {
    tid = tr.rows[0].id;
  }
  await query(t, 'INSERT INTO account_tags (account_id,tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [c.req.param('id'), tid]);
  return c.json({ message: 'Tag added' });
});

// ── GET /accounts/:id/activities ──
accounts.get('/:id/activities', async (c) => {
  const t = c.get('tenantId') as string;
  const lim = parseInt(c.req.query('limit') || '20');
  return c.json((await query(t,
    `SELECT * FROM activities WHERE entity_type='account' AND entity_id=$1 ORDER BY timestamp DESC LIMIT $2`,
    [c.req.param('id'), lim])).rows);
});

export default accounts;
