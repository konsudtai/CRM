/* SalesFAST 7 — Data Layer
 * Production: data loaded from API
 * Constants (colors, labels) kept here for UI rendering
 */

// ── API Base URL ──
// CloudFront routes /auth/*, /accounts/*, etc. to API Gateway
// So API_BASE should be empty string (same origin) when served from CloudFront
const API_BASE = window.__SF7_API_BASE__ || '';

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

// ── Empty datasets (populated from API) ──
let STAGES       = [];
let REPS         = [];
let LEADS_DATA   = { New: [], Contacted: [], Qualified: [], Proposal: [], Negotiation: [], Won: [], Lost: [] };
let ACCOUNTS     = [];
let CONTACTS     = [];
let OPPS         = [];
let TASKS        = [];
let QUOTATIONS   = [];
let PRODUCTS     = [];
let NOTIFICATIONS = [];

// ── Data loaders — call from each page ──
async function loadAccounts(search) {
  try {
    const params = search ? '?search=' + encodeURIComponent(search) : '';
    const res = await apiFetch('/accounts' + params);
    ACCOUNTS = res?.data || res || [];
    return ACCOUNTS;
  } catch(e) { console.error('loadAccounts:', e); return []; }
}

async function loadLeads(status, search) {
  try {
    let params = '?limit=100';
    if (status) params += '&status=' + status;
    if (search) params += '&search=' + encodeURIComponent(search);
    const res = await apiFetch('/leads' + params);
    const leads = res?.data || res || [];
    // Group by status for Kanban
    LEADS_DATA = { New: [], Contacted: [], Qualified: [], Proposal: [], Negotiation: [], Won: [], Lost: [] };
    leads.forEach(function(l) {
      var s = l.status || 'New';
      if (LEADS_DATA[s]) LEADS_DATA[s].push({
        id: l.id, name: l.name, company: l.company_name, email: l.email, phone: l.phone,
        source: l.source, value: 0, assignedTo: l.assigned_to, aiScore: l.ai_score
      });
    });
    return leads;
  } catch(e) { console.error('loadLeads:', e); return []; }
}

async function loadTasks(status) {
  try {
    let params = '?limit=100';
    if (status) params += '&status=' + status;
    const res = await apiFetch('/tasks' + params);
    TASKS = res || [];
    return TASKS;
  } catch(e) { console.error('loadTasks:', e); return []; }
}

async function loadProducts(search) {
  try {
    const params = search ? '?search=' + encodeURIComponent(search) : '';
    const res = await apiFetch('/products' + params);
    PRODUCTS = res || [];
    return PRODUCTS;
  } catch(e) { console.error('loadProducts:', e); return []; }
}

async function loadQuotations(status) {
  try {
    let params = '?limit=100';
    if (status) params += '&status=' + status;
    const res = await apiFetch('/quotations' + params);
    QUOTATIONS = res || [];
    return QUOTATIONS;
  } catch(e) { console.error('loadQuotations:', e); return []; }
}

async function loadOpportunities() {
  try {
    const res = await apiFetch('/opportunities');
    OPPS = res || [];
    return OPPS;
  } catch(e) { console.error('loadOpportunities:', e); return []; }
}

async function loadNotifications() {
  try {
    const res = await apiFetch('/notifications');
    NOTIFICATIONS = res || [];
    return NOTIFICATIONS;
  } catch(e) { console.error('loadNotifications:', e); return []; }
}

async function loadPipelineStages() {
  try {
    const res = await apiFetch('/leads/pipeline/stages');
    STAGES = res || [];
    return STAGES;
  } catch(e) { console.error('loadPipelineStages:', e); return []; }
}
