/* SalesFAST 7 — Unified Navigation (i18n) */

function getUserProfile() {
  const def = { username:'admin', email:'admin@salesfast7.com', role:'Admin', firstName:'System', lastName:'Admin', phone:'', birthday:'', address:'' };
  try { return JSON.parse(localStorage.getItem('sf7-user') || 'null') || def; } catch { return def; }
}
function saveUserProfile(p) { localStorage.setItem('sf7-user', JSON.stringify(p)); }

function getNavMenus() {
  return [
    { key:'dashboard', label:t('nav_dashboard'), items:[{page:'dashboard',name:t('nav_dashboard'),desc:t('nav_kpi_desc')}] },
    { key:'crm', label:t('nav_crm'), items:[{page:'accounts',name:t('nav_accounts'),desc:t('nav_accounts_desc')},{page:'contacts',name:t('nav_contacts'),desc:t('nav_contacts_desc')}] },
    { key:'sales', label:t('nav_sales'), items:[{page:'leads',name:t('nav_leads'),desc:t('nav_leads_desc')},{page:'opportunities',name:t('nav_opportunities'),desc:t('nav_opportunities_desc')}] },
    { key:'activity', label:t('nav_activities'), items:[{page:'tasks',name:t('nav_tasks'),desc:t('nav_tasks_desc')},{page:'calendar',name:t('nav_calendar'),desc:t('nav_calendar_desc')}] },
    { key:'docs', label:t('nav_documents'), items:[{page:'quotations',name:t('nav_quotations'),desc:t('nav_quotations_desc')},{page:'products',name:t('nav_products'),desc:t('nav_products_desc')}] },
    { key:'system', label:t('nav_settings'), items:[{page:'notifications',name:t('nav_notifications'),desc:t('nav_notifications_desc')},{page:'settings',name:t('nav_settings_page'),desc:t('nav_settings_desc')}] },
  ];
}

function renderNav(activePage) {
  const menus = getNavMenus();
  let activeMenu = '';
  for (const m of menus) { if (m.items.some(i => i.page === activePage)) { activeMenu = m.key; break; } }

  const menuHtml = menus.map(menu => {
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

  // Mobile menu
  const mobileHtml = menus.map(menu => {
    const label = menu.label.toUpperCase();
    return `<div class="sf7-mm-label">${label}</div>` +
      menu.items.map(item => `<a href="${item.page}.html" class="${item.page===activePage?'active':''}">${item.name}</a>`).join('');
  }).join('');

  const user = getUserProfile();
  const initials = (user.firstName?.[0]||'') + (user.lastName?.[0]||'');
  const curLang = getLang();

  return `<nav class="sf7-nav">
    <div class="sf7-nav-left">
      <button class="sf7-hamburger" onclick="toggleMobileMenu()" aria-label="Menu">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <a href="dashboard.html" class="sf7-brand">SalesFAST <span style="color:#4BCA81">7</span></a>
      <div class="sf7-nav-items">${menuHtml}</div>
    </div>
    <div class="sf7-nav-right">
      <div class="sf7-lang-toggle">
        <button class="sf7-lang-btn${curLang==='th'?' active':''}" onclick="setLang('th')">TH</button>
        <button class="sf7-lang-btn${curLang==='en'?' active':''}" onclick="setLang('en')">EN</button>
      </div>
      <button class="sf7-util" onclick="toggleTheme()" title="Toggle theme"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg></button>
      <a href="notifications.html" class="sf7-util" title="${t('nav_notifications')}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg></a>
      <div class="sf7-user-wrap">
        <button class="sf7-avatar" onclick="toggleUserMenu()" title="${user.firstName} ${user.lastName}">${initials||'U'}</button>
        <div class="sf7-user-menu" id="sf7-user-menu">
          <div class="sf7-um-header">
            <div class="sf7-um-avatar">${initials||'U'}</div>
            <div><div class="sf7-um-name">${user.firstName} ${user.lastName}</div><div class="sf7-um-email">${user.email}</div><div class="sf7-um-role">${user.role}</div></div>
          </div>
          <div class="sf7-um-divider"></div>
          <button class="sf7-um-btn" onclick="openProfileModal()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${t('user_edit')}</button>
          <button class="sf7-um-btn" onclick="openPasswordModal()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>${t('user_password')}</button>
          <div class="sf7-um-divider"></div>
          <button class="sf7-um-btn sf7-um-logout" onclick="doLogout()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>${t('user_logout')}</button>
        </div>
      </div>
    </div>
  </nav>
  <div class="sf7-mobile-menu" id="sf7-mobile-menu">${mobileHtml}</div>
  <div class="sf7-modal-overlay" id="profile-modal">
    <div class="sf7-modal">
      <div class="sf7-modal-header"><div style="font-size:17px;font-weight:700">${t('profile_title')}</div><button class="sf7-modal-close" onclick="closeProfileModal()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>
      <form onsubmit="saveProfile(event)">
        <div class="sf7-form-row"><div class="sf7-form-group"><label class="sf7-form-label">${t('pf_first')}</label><input class="sf7-form-input" id="pf-first" required/></div><div class="sf7-form-group"><label class="sf7-form-label">${t('pf_last')}</label><input class="sf7-form-input" id="pf-last" required/></div></div>
        <div class="sf7-form-group"><label class="sf7-form-label">${t('pf_username')}</label><input class="sf7-form-input" id="pf-username" required/></div>
        <div class="sf7-form-group"><label class="sf7-form-label">${t('pf_email')}</label><input class="sf7-form-input" id="pf-email" type="email" required/></div>
        <div class="sf7-form-group"><label class="sf7-form-label">${t('pf_role')}</label><input class="sf7-form-input" id="pf-role" readonly style="opacity:.6;cursor:not-allowed"/></div>
        <div class="sf7-form-row"><div class="sf7-form-group"><label class="sf7-form-label">${t('pf_phone')}</label><input class="sf7-form-input" id="pf-phone"/></div><div class="sf7-form-group"><label class="sf7-form-label">${t('pf_birthday')}</label><input class="sf7-form-input" id="pf-birthday" type="date"/></div></div>
        <div class="sf7-form-group"><label class="sf7-form-label">${t('pf_address')}</label><textarea class="sf7-form-input" id="pf-address" rows="2"></textarea></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px"><button type="button" class="btn btn-secondary" onclick="closeProfileModal()">${t('btn_cancel')}</button><button type="submit" class="btn btn-primary">${t('btn_save')}</button></div>
      </form>
    </div>
  </div>
  <div class="sf7-modal-overlay" id="password-modal">
    <div class="sf7-modal" style="max-width:400px">
      <div class="sf7-modal-header"><div style="font-size:17px;font-weight:700">${t('pw_title')}</div><button class="sf7-modal-close" onclick="closePasswordModal()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>
      <form onsubmit="savePassword(event)">
        <div class="sf7-form-group"><label class="sf7-form-label">${t('pw_current')}</label><input class="sf7-form-input" id="pw-current" type="password" required/></div>
        <div class="sf7-form-group"><label class="sf7-form-label">${t('pw_new')}</label><input class="sf7-form-input" id="pw-new" type="password" required minlength="8"/></div>
        <div class="sf7-form-group"><label class="sf7-form-label">${t('pw_confirm')}</label><input class="sf7-form-input" id="pw-confirm" type="password" required minlength="8"/></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px"><button type="button" class="btn btn-secondary" onclick="closePasswordModal()">${t('btn_cancel')}</button><button type="submit" class="btn btn-primary">${t('pw_update')}</button></div>
      </form>
    </div>
  </div>`;
}

function toggleMobileMenu(){document.getElementById('sf7-mobile-menu').classList.toggle('open')}
function toggleUserMenu(){document.getElementById('sf7-user-menu').classList.toggle('open')}
document.addEventListener('click',e=>{const m=document.getElementById('sf7-user-menu');if(m&&!e.target.closest('.sf7-user-wrap'))m.classList.remove('open')});
function openProfileModal(){document.getElementById('sf7-user-menu').classList.remove('open');const p=getUserProfile();document.getElementById('pf-first').value=p.firstName||'';document.getElementById('pf-last').value=p.lastName||'';document.getElementById('pf-username').value=p.username||'';document.getElementById('pf-email').value=p.email||'';document.getElementById('pf-role').value=p.role||'';document.getElementById('pf-phone').value=p.phone||'';document.getElementById('pf-birthday').value=p.birthday||'';document.getElementById('pf-address').value=p.address||'';document.getElementById('profile-modal').classList.add('open')}
function closeProfileModal(){document.getElementById('profile-modal').classList.remove('open')}
function saveProfile(e){e.preventDefault();const p=getUserProfile();p.firstName=document.getElementById('pf-first').value;p.lastName=document.getElementById('pf-last').value;p.username=document.getElementById('pf-username').value;p.email=document.getElementById('pf-email').value;p.phone=document.getElementById('pf-phone').value;p.birthday=document.getElementById('pf-birthday').value;p.address=document.getElementById('pf-address').value;saveUserProfile(p);closeProfileModal();location.reload()}
function openPasswordModal(){document.getElementById('sf7-user-menu').classList.remove('open');document.getElementById('pw-current').value='';document.getElementById('pw-new').value='';document.getElementById('pw-confirm').value='';document.getElementById('password-modal').classList.add('open')}
function closePasswordModal(){document.getElementById('password-modal').classList.remove('open')}
function savePassword(e){e.preventDefault();if(document.getElementById('pw-new').value!==document.getElementById('pw-confirm').value){alert('Passwords do not match');return}alert('Password updated');closePasswordModal()}
function doLogout(){localStorage.removeItem('sf7-user');window.location.href='../login.html'}
document.addEventListener('DOMContentLoaded',()=>initTheme());
