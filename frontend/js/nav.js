/* SalesFAST 7 — Unified Navigation */

/* User profile stored in localStorage */
function getUserProfile() {
  const def = { username:'admin', email:'admin@salesfast7.com', role:'Admin', firstName:'System', lastName:'Admin', phone:'', birthday:'', address:'' };
  try { return JSON.parse(localStorage.getItem('sf7-user') || 'null') || def; } catch { return def; }
}
function saveUserProfile(p) { localStorage.setItem('sf7-user', JSON.stringify(p)); }

const NAV_MENUS = [
  { key:'dashboard', label:'Dashboard', items:[{page:'dashboard',name:'Dashboard',desc:'KPI & Overview'}] },
  { key:'crm', label:'CRM', items:[{page:'accounts',name:'Accounts',desc:'Customer accounts'},{page:'contacts',name:'Contacts',desc:'Contact people'}] },
  { key:'sales', label:'Sales', items:[{page:'leads',name:'Leads',desc:'Lead pipeline'},{page:'opportunities',name:'Opportunities',desc:'Deal management'}] },
  { key:'activity', label:'Activities', items:[{page:'tasks',name:'Tasks',desc:'Task management'},{page:'calendar',name:'Calendar',desc:'Schedule & events'}] },
  { key:'docs', label:'Documents', items:[{page:'quotations',name:'Quotations',desc:'Proposals & quotes'},{page:'products',name:'Products',desc:'Product catalog'}] },
  { key:'system', label:'Settings', items:[{page:'notifications',name:'Notifications',desc:'Alerts & messages'},{page:'settings',name:'Settings',desc:'System config'}] },
];

function renderNav(activePage) {
  let activeMenu = '';
  for (const m of NAV_MENUS) { if (m.items.some(i => i.page === activePage)) { activeMenu = m.key; break; } }

  const menuHtml = NAV_MENUS.map(menu => {
    const isActive = menu.key === activeMenu;
    if (menu.items.length === 1) {
      return `<a href="${menu.items[0].page}.html" class="sf7-nav-item${isActive?' active':''}">${menu.label}</a>`;
    }
    return `<div class="sf7-nav-group">
      <button class="sf7-nav-item${isActive?' active':''}">${menu.label} <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1.5 3L4 5.5L6.5 3"/></svg></button>
      <div class="sf7-dropdown">${menu.items.map(item =>
        `<a href="${item.page}.html" class="sf7-drop-item${item.page===activePage?' current':''}"><div class="sf7-drop-name">${item.name}</div><div class="sf7-drop-desc">${item.desc}</div></a>`
      ).join('')}</div>
    </div>`;
  }).join('');

  const user = getUserProfile();
  const initials = (user.firstName?.[0]||'') + (user.lastName?.[0]||'');

  return `<nav class="sf7-nav">
    <div class="sf7-nav-left">
      <a href="dashboard.html" class="sf7-brand">SalesFAST <span style="color:#4BCA81">7</span></a>
      <div class="sf7-nav-items">${menuHtml}</div>
    </div>
    <div class="sf7-nav-right">
      <button class="sf7-util" onclick="toggleTheme()" title="Toggle theme"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg></button>
      <a href="notifications.html" class="sf7-util" title="Notifications"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg></a>
      <div class="sf7-user-wrap">
        <button class="sf7-avatar" onclick="toggleUserMenu()" title="${user.firstName} ${user.lastName}">${initials||'U'}</button>
        <div class="sf7-user-menu" id="sf7-user-menu">
          <div class="sf7-um-header">
            <div class="sf7-um-avatar">${initials||'U'}</div>
            <div>
              <div class="sf7-um-name">${user.firstName} ${user.lastName}</div>
              <div class="sf7-um-email">${user.email}</div>
              <div class="sf7-um-role">${user.role}</div>
            </div>
          </div>
          <div class="sf7-um-divider"></div>
          <button class="sf7-um-btn" onclick="openProfileModal()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Edit Profile
          </button>
          <button class="sf7-um-btn" onclick="openPasswordModal()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            Change Password
          </button>
          <div class="sf7-um-divider"></div>
          <button class="sf7-um-btn sf7-um-logout" onclick="doLogout()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Log out
          </button>
        </div>
      </div>
    </div>
  </nav>

  <!-- Profile Modal -->
  <div class="sf7-modal-overlay" id="profile-modal">
    <div class="sf7-modal">
      <div class="sf7-modal-header">
        <div style="font-size:17px;font-weight:700">Edit Profile</div>
        <button class="sf7-modal-close" onclick="closeProfileModal()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <form onsubmit="saveProfile(event)">
        <div class="sf7-form-row">
          <div class="sf7-form-group"><label class="sf7-form-label">First Name</label><input class="sf7-form-input" id="pf-first" required/></div>
          <div class="sf7-form-group"><label class="sf7-form-label">Last Name</label><input class="sf7-form-input" id="pf-last" required/></div>
        </div>
        <div class="sf7-form-group"><label class="sf7-form-label">Username</label><input class="sf7-form-input" id="pf-username" required/></div>
        <div class="sf7-form-group"><label class="sf7-form-label">Email</label><input class="sf7-form-input" id="pf-email" type="email" required/></div>
        <div class="sf7-form-group"><label class="sf7-form-label">Role</label><input class="sf7-form-input" id="pf-role" readonly style="opacity:.6;cursor:not-allowed"/></div>
        <div class="sf7-form-row">
          <div class="sf7-form-group"><label class="sf7-form-label">Phone</label><input class="sf7-form-input" id="pf-phone" placeholder="08x-xxx-xxxx"/></div>
          <div class="sf7-form-group"><label class="sf7-form-label">Birthday</label><input class="sf7-form-input" id="pf-birthday" type="date"/></div>
        </div>
        <div class="sf7-form-group"><label class="sf7-form-label">Address</label><textarea class="sf7-form-input" id="pf-address" rows="2" placeholder="Street, District, Province, Postal Code"></textarea></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px">
          <button type="button" class="btn btn-secondary" onclick="closeProfileModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Password Modal -->
  <div class="sf7-modal-overlay" id="password-modal">
    <div class="sf7-modal" style="max-width:400px">
      <div class="sf7-modal-header">
        <div style="font-size:17px;font-weight:700">Change Password</div>
        <button class="sf7-modal-close" onclick="closePasswordModal()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <form onsubmit="savePassword(event)">
        <div class="sf7-form-group"><label class="sf7-form-label">Current Password</label><input class="sf7-form-input" id="pw-current" type="password" required/></div>
        <div class="sf7-form-group"><label class="sf7-form-label">New Password</label><input class="sf7-form-input" id="pw-new" type="password" required minlength="8"/></div>
        <div class="sf7-form-group"><label class="sf7-form-label">Confirm New Password</label><input class="sf7-form-input" id="pw-confirm" type="password" required minlength="8"/></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px">
          <button type="button" class="btn btn-secondary" onclick="closePasswordModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Update Password</button>
        </div>
      </form>
    </div>
  </div>`;
}

/* User menu toggle */
function toggleUserMenu() {
  const menu = document.getElementById('sf7-user-menu');
  menu.classList.toggle('open');
}
document.addEventListener('click', e => {
  const menu = document.getElementById('sf7-user-menu');
  const wrap = e.target.closest('.sf7-user-wrap');
  if (menu && !wrap) menu.classList.remove('open');
});

/* Profile modal */
function openProfileModal() {
  document.getElementById('sf7-user-menu').classList.remove('open');
  const p = getUserProfile();
  document.getElementById('pf-first').value = p.firstName || '';
  document.getElementById('pf-last').value = p.lastName || '';
  document.getElementById('pf-username').value = p.username || '';
  document.getElementById('pf-email').value = p.email || '';
  document.getElementById('pf-role').value = p.role || '';
  document.getElementById('pf-phone').value = p.phone || '';
  document.getElementById('pf-birthday').value = p.birthday || '';
  document.getElementById('pf-address').value = p.address || '';
  document.getElementById('profile-modal').classList.add('open');
}
function closeProfileModal() { document.getElementById('profile-modal').classList.remove('open'); }
function saveProfile(e) {
  e.preventDefault();
  const p = getUserProfile();
  p.firstName = document.getElementById('pf-first').value;
  p.lastName = document.getElementById('pf-last').value;
  p.username = document.getElementById('pf-username').value;
  p.email = document.getElementById('pf-email').value;
  p.phone = document.getElementById('pf-phone').value;
  p.birthday = document.getElementById('pf-birthday').value;
  p.address = document.getElementById('pf-address').value;
  saveUserProfile(p);
  closeProfileModal();
  location.reload();
}

/* Password modal */
function openPasswordModal() {
  document.getElementById('sf7-user-menu').classList.remove('open');
  document.getElementById('pw-current').value = '';
  document.getElementById('pw-new').value = '';
  document.getElementById('pw-confirm').value = '';
  document.getElementById('password-modal').classList.add('open');
}
function closePasswordModal() { document.getElementById('password-modal').classList.remove('open'); }
function savePassword(e) {
  e.preventDefault();
  const nw = document.getElementById('pw-new').value;
  const cf = document.getElementById('pw-confirm').value;
  if (nw !== cf) { alert('Passwords do not match'); return; }
  if (nw.length < 8) { alert('Password must be at least 8 characters'); return; }
  alert('Password updated successfully');
  closePasswordModal();
}

/* Logout */
function doLogout() {
  localStorage.removeItem('sf7-user');
  window.location.href = '../login.html';
}

document.addEventListener('DOMContentLoaded', () => initTheme());
