/* SalesFAST 7 — Data Layer
 * Production: data loaded from API
 * Constants (colors, labels) kept here for UI rendering
 */

// ── API Base URL ──
const API_BASE = window.__SF7_API_BASE__ || '/api';

// ── API helper ──
async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('sf7_token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(API_BASE + path, { ...options, headers });
  if (res.status === 401) { clearToken(); window.location.href = '../login.html'; return null; }
  if (!res.ok) throw new Error('API error: ' + res.status);
  return res.json();
}

// ── KPI defaults (overwritten by API response) ──
const DEFAULT_KPI = {
  month:   { closed: 0, target: 0, leads: 0, conv: 0 },
  quarter: { closed: 0, target: 0, leads: 0, conv: 0 },
  year:    { closed: 0, target: 0, leads: 0, conv: 0 },
};

// ── Pipeline stage colors (UI constants — not mock data) ──
const STAGE_COLORS = {
  New: '#1B96FF', Contacted: '#7F56D9', Qualified: '#0B827C',
  Proposal: '#DD7A01', Negotiation: '#C23934', Won: '#2E844A', Lost: '#939393',
};
const STAGES_ORDER = ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];

// ── Status labels & colors (UI constants) ──
const STATUS_LABELS = {
  draft: 'ร่าง', pending_approval: 'รออนุมัติ',
  sent: 'ส่งแล้ว', accepted: 'ยอมรับ', rejected: 'ปฏิเสธ',
};
const STATUS_COLORS = {
  draft: 'var(--text3)', pending_approval: 'var(--orange)',
  sent: 'var(--sf-blue)', accepted: 'var(--green)', rejected: 'var(--red)',
};
const PRI_COLORS  = { High: 'var(--red)', Medium: 'var(--orange)', Low: 'var(--text3)' };
const TASK_COLORS = { Open: 'var(--text2)', 'In Progress': 'var(--sf-blue)', Completed: 'var(--green)', Overdue: 'var(--red)' };

// ── Empty datasets (populated from API in production) ──
const STAGES       = [];
const REPS         = [];
const LEADS_DATA   = { New: [], Contacted: [], Qualified: [], Proposal: [], Negotiation: [], Won: [], Lost: [] };
const ACCOUNTS     = [];
const CONTACTS     = [];
const OPPS         = [];
const TASKS        = [];
const QUOTATIONS   = [];
const PRODUCTS     = [];
const NOTIFICATIONS = [];
