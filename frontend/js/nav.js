/* SalesFAST 7 — Unified Navigation */

const NAV_MENUS = [
  {
    key: 'dashboard', label: 'Dashboard',
    items: [{ page: 'dashboard', name: 'Dashboard', desc: 'KPI & Overview' }]
  },
  {
    key: 'crm', label: 'CRM',
    items: [
      { page: 'accounts', name: 'Accounts', desc: 'Customer accounts' },
      { page: 'contacts', name: 'Contacts', desc: 'Contact people' },
    ]
  },
  {
    key: 'sales', label: 'Sales',
    items: [
      { page: 'leads', name: 'Leads', desc: 'Lead pipeline' },
      { page: 'opportunities', name: 'Opportunities', desc: 'Deal management' },
    ]
  },
  {
    key: 'activity', label: 'Activities',
    items: [
      { page: 'tasks', name: 'Tasks', desc: 'Task management' },
      { page: 'calendar', name: 'Calendar', desc: 'Schedule & events' },
    ]
  },
  {
    key: 'docs', label: 'Documents',
    items: [
      { page: 'quotations', name: 'Quotations', desc: 'Proposals & quotes' },
      { page: 'products', name: 'Products', desc: 'Product catalog' },
    ]
  },
  {
    key: 'system', label: 'Settings',
    items: [
      { page: 'notifications', name: 'Notifications', desc: 'Alerts & messages' },
      { page: 'settings', name: 'Settings', desc: 'System config' },
    ]
  },
];

function renderNav(activePage) {
  // Find which menu group the active page belongs to
  let activeMenu = '';
  for (const m of NAV_MENUS) {
    if (m.items.some(i => i.page === activePage)) { activeMenu = m.key; break; }
  }

  const menuHtml = NAV_MENUS.map(menu => {
    const isActive = menu.key === activeMenu;
    const isSingle = menu.items.length === 1;

    if (isSingle) {
      const item = menu.items[0];
      return `<a href="${item.page}.html" class="sf7-nav-item${isActive ? ' active' : ''}">${menu.label}</a>`;
    }

    const dropdownItems = menu.items.map(item =>
      `<a href="${item.page}.html" class="sf7-drop-item${item.page === activePage ? ' current' : ''}">
        <div class="sf7-drop-name">${item.name}</div>
        <div class="sf7-drop-desc">${item.desc}</div>
      </a>`
    ).join('');

    return `<div class="sf7-nav-group">
      <button class="sf7-nav-item${isActive ? ' active' : ''}">${menu.label} <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1.5 3L4 5.5L6.5 3"/></svg></button>
      <div class="sf7-dropdown">${dropdownItems}</div>
    </div>`;
  }).join('');

  return `<nav class="sf7-nav">
    <div class="sf7-nav-left">
      <a href="dashboard.html" class="sf7-brand">SalesFAST <span style="color:#4BCA81">7</span></a>
      <div class="sf7-nav-items">${menuHtml}</div>
    </div>
    <div class="sf7-nav-right">
      <button class="sf7-util" onclick="toggleTheme()" title="Toggle theme"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg></button>
      <a href="notifications.html" class="sf7-util" title="Notifications"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg></a>
      <div class="sf7-avatar">SF<span style="color:#4BCA81">7</span></div>
    </div>
  </nav>`;
}

document.addEventListener('DOMContentLoaded', () => initTheme());
