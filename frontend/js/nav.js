/* SalesFAST 7 — Unified Navigation (i18n) */

function getUserProfile() {
  const def = { username:'', email:'', role:'Viewer', firstName:'', lastName:'', phone:'', birthday:'', address:'' };
  try { return JSON.parse(localStorage.getItem('sf7-user') || 'null') || def; } catch { return def; }
}
function saveUserProfile(p) { localStorage.setItem('sf7-user', JSON.stringify(p)); }

// Load user profile from API on page load (updates localStorage with real DB data)
async function loadUserProfile() {
  try {
    var token = localStorage.getItem('sf7_token');
    if (!token) return;
    var res = await fetch((window.__SF7_API_BASE__ || '') + '/auth/me', {
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
    });
    if (!res.ok) { if (res.status === 401) { localStorage.removeItem('sf7_token'); window.location.href = '../login.html'; } return; }
    var data = await res.json();
    var profile = {
      id: data.id,
      tenantId: data.tenant_id,
      email: data.email,
      firstName: data.first_name || '',
      lastName: data.last_name || '',
      phone: data.phone || '',
      role: (data.roles && data.roles[0]) || 'Viewer',
      roles: data.roles || [],
      permissions: data.permissions || {},
      lineId: data.line_id || '',
      mfaEnabled: data.mfa_enabled || false,
      preferredLanguage: data.preferred_language || 'th',
    };
    saveUserProfile(profile);
    // Update nav display
    var avatarEl = document.querySelector('.sf7-nav-avatar');
    if (avatarEl) avatarEl.textContent = (profile.firstName[0]||'') + (profile.lastName[0]||'');
    var nameEl = document.querySelector('.sf7-um-name');
    if (nameEl) nameEl.textContent = profile.firstName + ' ' + profile.lastName;
    var emailEl = document.querySelector('.sf7-um-email');
    if (emailEl) emailEl.textContent = profile.email;
    var roleEl = document.querySelector('.sf7-um-role');
    if (roleEl) roleEl.textContent = profile.role;
  } catch(e) { console.error('loadUserProfile:', e); }
}
// Auto-load on every page
setTimeout(loadUserProfile, 100);

function getNavMenus() {
  return [
    { key:'dashboard', label:t('nav_dashboard'), items:[{page:'dashboard',name:t('nav_dashboard'),desc:t('nav_kpi_desc')}] },
    { key:'crm', label:t('nav_crm'), items:[{page:'accounts',name:t('nav_accounts'),desc:t('nav_accounts_desc')}] },
    { key:'sales', label:t('nav_sales'), items:[{page:'leads',name:t('nav_pipeline'),desc:t('nav_pipeline_desc')}] },
    { key:'activity', label:t('nav_activities'), items:[{page:'tasks',name:t('nav_tasks'),desc:t('nav_tasks_desc')},{page:'calendar',name:t('nav_calendar'),desc:t('nav_calendar_desc')}] },
    { key:'docs', label:t('nav_documents'), items:[{page:'quotations',name:t('nav_quotations'),desc:t('nav_quotations_desc')},{page:'products',name:t('nav_products'),desc:t('nav_products_desc')},{page:'manual',name:'User Manual',desc:'คู่มือการใช้งาน / User Guide'}] },
  ].concat(getUserProfile().role==='Admin'?[{ key:'system', label:t('nav_settings'), items:[{page:'settings',name:t('nav_settings_page'),desc:t('nav_settings_desc')}] }]:[]);
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
        <button class="sf7-avatar" onclick="toggleUserMenu()" title="${user.firstName} ${user.lastName}">${user.avatarUrl?'<img src="'+user.avatarUrl+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>':initials||'U'}</button>
        <div class="sf7-user-menu" id="sf7-user-menu">
          <div class="sf7-um-header">
            <div class="sf7-um-avatar">${user.avatarUrl?'<img src="'+user.avatarUrl+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>':initials||'U'}</div>
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
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
          <div style="position:relative">
            <div id="pf-avatar-preview" style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,var(--sf-blue-l,#1B96FF),#7F56D9);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#fff;overflow:hidden;cursor:pointer;border:3px solid var(--border)" onclick="document.getElementById('pf-avatar-input').click()">${initials||'U'}</div>
            <div style="position:absolute;bottom:-2px;right:-2px;width:22px;height:22px;border-radius:50%;background:var(--sf-blue,#0176D3);display:flex;align-items:center;justify-content:center;cursor:pointer;border:2px solid var(--surface,#fff)" onclick="document.getElementById('pf-avatar-input').click()"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>
            <input type="file" id="pf-avatar-input" accept="image/*" style="display:none" onchange="handleAvatarUpload(this.files)"/>
          </div>
          <div style="font-size:12px;color:var(--text3)">คลิกที่รูปเพื่อเปลี่ยน<br>รองรับ JPG, PNG (max 2MB)</div>
        </div>
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
function openProfileModal(){document.getElementById('sf7-user-menu').classList.remove('open');const p=getUserProfile();document.getElementById('pf-first').value=p.firstName||'';document.getElementById('pf-last').value=p.lastName||'';document.getElementById('pf-username').value=p.username||'';document.getElementById('pf-email').value=p.email||'';document.getElementById('pf-role').value=p.role||'';document.getElementById('pf-phone').value=p.phone||'';document.getElementById('pf-birthday').value=p.birthday||'';document.getElementById('pf-address').value=p.address||'';if(p.avatarUrl){document.getElementById('pf-avatar-preview').innerHTML='<img src="'+p.avatarUrl+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>';}document.getElementById('profile-modal').classList.add('open')}
function closeProfileModal(){document.getElementById('profile-modal').classList.remove('open')}
function saveProfile(e){e.preventDefault();const p=getUserProfile();p.firstName=document.getElementById('pf-first').value;p.lastName=document.getElementById('pf-last').value;p.username=document.getElementById('pf-username').value;p.email=document.getElementById('pf-email').value;p.phone=document.getElementById('pf-phone').value;p.birthday=document.getElementById('pf-birthday').value;p.address=document.getElementById('pf-address').value;saveUserProfile(p);
  // Save to DB via API
  var token=localStorage.getItem('sf7_token');
  if(token){fetch((window.__SF7_API_BASE__||'')+'/users/'+p.id+'/profile',{method:'PATCH',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({firstName:p.firstName,lastName:p.lastName,phone:p.phone})}).catch(function(e){console.error('saveProfile API:',e)})}
  closeProfileModal();location.reload()}
function handleAvatarUpload(files){
  if(!files||!files.length)return;
  var f=files[0];
  if(f.size>2*1024*1024){alert('ไฟล์ใหญ่เกิน 2MB');return}
  if(!f.type.startsWith('image/')){alert('รองรับเฉพาะไฟล์รูปภาพ');return}
  var reader=new FileReader();
  reader.onload=function(ev){
    var url=ev.target.result;
    document.getElementById('pf-avatar-preview').innerHTML='<img src="'+url+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>';
    // Save to profile (in production: upload to S3 via presigned URL)
    var p=getUserProfile();
    p.avatarUrl=url;
    saveUserProfile(p);
  };
  reader.readAsDataURL(f);
}
function openPasswordModal(){document.getElementById('sf7-user-menu').classList.remove('open');document.getElementById('pw-current').value='';document.getElementById('pw-new').value='';document.getElementById('pw-confirm').value='';document.getElementById('password-modal').classList.add('open')}
function closePasswordModal(){document.getElementById('password-modal').classList.remove('open')}
function savePassword(e){e.preventDefault();if(document.getElementById('pw-new').value!==document.getElementById('pw-confirm').value){alert('Passwords do not match');return}
  var token=localStorage.getItem('sf7_token');
  fetch((window.__SF7_API_BASE__||'')+'/auth/change-password',{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({currentPassword:document.getElementById('pw-current').value,newPassword:document.getElementById('pw-new').value})}).then(function(r){return r.json()}).then(function(d){if(d.message==='Password changed successfully'){alert('Password updated successfully');closePasswordModal()}else{alert(d.message||'Error')}}).catch(function(e){alert('Error: '+e.message)})}
function doLogout(){localStorage.removeItem('sf7-user');localStorage.removeItem('sf7_token');localStorage.removeItem('sf7_refresh');window.location.href='../login.html'}
document.addEventListener('DOMContentLoaded',()=>{initTheme();initCoAgent()});

/* ══════════════════════════════════════════════════════════
   น้องขายไว — Floating Chat Widget
   ══════════════════════════════════════════════════════════ */
function initCoAgent(){
  // Don't show on login/landing pages
  if(location.pathname.includes('login') || location.pathname.includes('landing') || location.pathname.includes('liff')) return;

  // Inject CSS
  var style=document.createElement('style');
  style.textContent=`
.co-fab{position:fixed;bottom:24px;right:24px;z-index:900;width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#667EEA,#764BA2);box-shadow:0 4px 20px rgba(118,75,162,.4);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;border:3px solid #fff;padding:0;overflow:hidden}
.co-fab:hover{transform:scale(1.08);box-shadow:0 6px 28px rgba(118,75,162,.5)}
.co-fab:active{transform:scale(.95)}
.co-fab img{width:100%;height:100%;border-radius:50%;object-fit:cover}
.co-badge{position:absolute;top:-2px;right:-2px;width:20px;height:20px;border-radius:50%;background:#C23934;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid #fff;animation:co-pulse 2s ease infinite}
@keyframes co-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}
.co-panel{position:fixed;bottom:92px;right:24px;z-index:901;width:380px;max-height:520px;background:var(--surface,#fff);border-radius:16px;box-shadow:0 12px 48px rgba(0,0,0,.18);border:1px solid var(--border,#D4DAE3);display:flex;flex-direction:column;opacity:0;visibility:hidden;transform:translateY(12px) scale(.95);transition:all .2s;overflow:hidden}
.co-panel.open{opacity:1;visibility:visible;transform:translateY(0) scale(1)}
.co-header{background:linear-gradient(135deg,#032D60,#0176D3);padding:16px;display:flex;align-items:center;gap:12px}
.co-avatar{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#1B96FF,#7F56D9);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#fff;flex-shrink:0;border:2px solid rgba(255,255,255,.2)}
.co-header-info{flex:1}
.co-header-name{font-size:14px;font-weight:700;color:#fff}
.co-header-status{font-size:11px;color:rgba(255,255,255,.6);display:flex;align-items:center;gap:4px}
.co-header-dot{width:6px;height:6px;border-radius:50%;background:#4BCA81}
.co-close{width:28px;height:28px;border-radius:50%;border:none;background:rgba(255,255,255,.1);color:rgba(255,255,255,.7);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;transition:all .15s}
.co-close:hover{background:rgba(255,255,255,.2);color:#fff}
.co-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;min-height:200px;max-height:320px}
.co-msg{max-width:85%;padding:10px 14px;border-radius:12px;font-size:13px;line-height:1.5;animation:co-fade .3s ease}
@keyframes co-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.co-msg.agent{background:var(--surface2,#F7F9FB);color:var(--text,#16171A);align-self:flex-start;border-bottom-left-radius:4px}
.co-msg.user{background:#0176D3;color:#fff;align-self:flex-end;border-bottom-right-radius:4px}
.co-msg.notif{background:rgba(221,122,1,.08);border:1px solid rgba(221,122,1,.15);color:var(--text,#16171A);align-self:flex-start;border-radius:10px;font-size:12px}
.co-msg.notif strong{color:#DD7A01}
.co-typing{display:flex;gap:4px;padding:8px 14px;align-self:flex-start}
.co-typing span{width:6px;height:6px;border-radius:50%;background:var(--text3,#8E9BAE);animation:co-dot .6s ease infinite}
.co-typing span:nth-child(2){animation-delay:.1s}
.co-typing span:nth-child(3){animation-delay:.2s}
@keyframes co-dot{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
.co-quick{display:flex;gap:6px;flex-wrap:wrap;padding:0 16px 8px}
.co-quick-btn{padding:5px 12px;border-radius:20px;border:1px solid var(--border,#D4DAE3);background:var(--surface,#fff);font-size:11px;font-weight:500;color:var(--sf-blue,#0176D3);cursor:pointer;font-family:inherit;transition:all .15s}
.co-quick-btn:hover{background:rgba(1,118,211,.06);border-color:#0176D3}
.co-input-wrap{padding:12px 16px;border-top:1px solid var(--border,#D4DAE3);display:flex;gap:8px}
.co-input{flex:1;padding:10px 14px;border-radius:24px;border:1.5px solid var(--border,#D4DAE3);background:var(--surface2,#F7F9FB);font-size:13px;font-family:inherit;color:var(--text,#16171A);outline:none;transition:border-color .2s}
.co-input:focus{border-color:#0176D3}
.co-input::placeholder{color:var(--text3,#8E9BAE)}
.co-send{width:36px;height:36px;border-radius:50%;border:none;background:#0176D3;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0}
.co-send:hover{background:#014486}
@media(max-width:480px){.co-panel{width:calc(100vw - 24px);right:12px;bottom:80px;max-height:70vh}.co-fab{bottom:16px;right:16px;width:50px;height:50px}}
  `;
  document.head.appendChild(style);

  // Inject HTML
  var html=`
<button class="co-fab" id="co-fab" onclick="toggleCoAgent()">
  <img src="${location.pathname.includes('/app/')?'../img/co-agent-avatar.svg':'img/co-agent-avatar.svg'}" alt="น้องขายไว"/>
  <span class="co-badge" id="co-badge">2</span>
</button>
<div class="co-panel" id="co-panel">
  <div class="co-header">
    <div class="co-avatar"><img src="${location.pathname.includes('/app/')?'../img/co-agent-avatar.svg':'img/co-agent-avatar.svg'}" alt="SC" style="width:100%;height:100%;border-radius:50%"/></div>
    <div class="co-header-info">
      <div class="co-header-name">น้องขายไว</div>
      <div class="co-header-status"><span class="co-header-dot"></span> Online</div>
    </div>
    <button class="co-close" onclick="toggleCoAgent()">&times;</button>
  </div>
  <div class="co-messages" id="co-messages"></div>
  <div class="co-quick" id="co-quick"></div>
  <div class="co-input-wrap">
    <input class="co-input" id="co-input" placeholder="ถามอะไรก็ได้..." onkeydown="if(event.key==='Enter')sendCoMsg()"/>
    <button class="co-send" onclick="sendCoMsg()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
  </div>
</div>`;
  var div=document.createElement('div');
  div.innerHTML=html;
  while(div.firstChild)document.body.appendChild(div.firstChild);

  // Init messages
  initCoMessages();
}

var coOpen=false;
function toggleCoAgent(){
  coOpen=!coOpen;
  document.getElementById('co-panel').classList.toggle('open',coOpen);
  if(coOpen){
    document.getElementById('co-badge').style.display='none';
    var msgs=document.getElementById('co-messages');
    msgs.scrollTop=msgs.scrollHeight;
  }
}

function initCoMessages(){
  var user=getUserProfile(), role=user.role||'Sales Rep', name=user.firstName||'คุณ';
  var isM=role==='Sales Manager'||role==='Admin';
  addCoMsg('agent','สวัสดีค่ะ คุณ'+name+'! น้องขายไว พร้อมช่วยค่ะ 😊');
  setTimeout(function(){
    if(isM){
      addCoMsg('notif','<strong>📋 Daily Briefing</strong><br><br>🔴 Lead รอ assign: <strong>3</strong><br>🔴 QT รออนุมัติ: <strong>1</strong> (ศรีสมบูรณ์ ฿3.3M)<br>🟡 Deal ใกล้ปิด: ศรีสมบูรณ์ ฿3.2M<br>🟡 Task เกินกำหนดของทีม: <strong>2</strong><br>🟢 ยอดเดือนนี้: ฿4.28M / เป้า ฿6M (71%)');
    } else {
      var my=JSON.parse(localStorage.getItem('sf7-assigned-leads')||'[]').filter(function(l){return l.assignedTo===name});
      var b='<strong>📋 Daily Briefing</strong><br><br>';
      if(my.length) b+='🔴 Lead ใหม่ assign ให้คุณ: <strong>'+my.length+'</strong><br>';
      b+='🟡 งานวันนี้: <strong>3</strong><br>🔴 เกินกำหนด: <strong>1</strong><br>🟢 ยอดของคุณ: ฿1.2M / เป้า ฿3M (40%)';
      addCoMsg('notif',b);
    }
  },500);
  if(isM) setTimeout(function(){addCoMsg('notif','<strong>📄 QT รออนุมัติ</strong><br>QT-2569-0004 ศรีสมบูรณ์ ฿3.3M<br>โดย: สมชาย<br><br>พิมพ์ "<strong>approve</strong>" หรือ "<strong>reject</strong>"')},1000);
  var qi=isM?['Assign Lead','Approve QT','สรุปทีม','Lead ใหม่','งานเกินกำหนด','QT Status']:['Lead ของฉัน','งานวันนี้','สร้าง QT','Deal โฟกัส','เขียน Email','สรุปลูกค้า'];
  document.getElementById('co-quick').innerHTML=qi.map(function(t){return '<button class="co-quick-btn" onclick="sendCoQuick(this.textContent)">'+t+'</button>'}).join('');
  document.getElementById('co-badge').textContent=isM?'4':'2';
}
function notifySalesRep(r,l,i,b,t){var a=JSON.parse(localStorage.getItem('sf7-assigned-leads')||'[]');a.push({assignedTo:r,leadName:l,interest:i,budget:b,task:t||'ติดต่อลูกค้าภายในวันนี้',assignedAt:new Date().toISOString()});localStorage.setItem('sf7-assigned-leads',JSON.stringify(a))}
function addCoMsg(type,text){var m=document.getElementById('co-messages'),d=document.createElement('div');d.className='co-msg '+type;d.innerHTML=text;m.appendChild(d);m.scrollTop=m.scrollHeight}

function sendCoMsg(){
  var inp=document.getElementById('co-input'),t=inp.value.trim();
  if(!t)return;
  inp.value='';
  addCoMsg('user',esc(t));

  // Show typing indicator
  var ty=document.createElement('div');ty.className='co-typing';ty.id='co-typing';
  ty.innerHTML='<span></span><span></span><span></span>';
  document.getElementById('co-messages').appendChild(ty);

  // Call Agent Service API (streaming)
  var user=getUserProfile();
  var agentApi=(window.__SF7_API_BASE__||'/api')+'/agents/stream';
  var body=JSON.stringify({
    message:t,
    agentType:'sales-assistant',
    tenantId:user.tenantId||'default',
    userId:user.id||'unknown',
    userRole:user.role||'Sales Rep'
  });

  fetch(agentApi,{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+(localStorage.getItem('sf7_token')||'')},
    body:body
  }).then(function(res){
    var e=document.getElementById('co-typing');if(e)e.remove();
    if(!res.ok||!res.body){addCoMsg('agent','ขออภัยค่ะ เกิดข้อผิดพลาด กรุณาลองใหม่ค่ะ');return}

    // Read SSE stream
    var reader=res.body.getReader();
    var decoder=new TextDecoder();
    var msgDiv=document.createElement('div');msgDiv.className='co-msg agent';
    document.getElementById('co-messages').appendChild(msgDiv);
    var fullText='';

    function readChunk(){
      reader.read().then(function(result){
        if(result.done){if(!fullText)msgDiv.innerHTML='ขออภัยค่ะ ไม่มีข้อมูลตอบกลับค่ะ';return}
        var chunk=decoder.decode(result.value,{stream:true});
        var lines=chunk.split('\n');
        lines.forEach(function(line){
          if(!line.startsWith('data: '))return;
          var data=line.slice(6).trim();
          if(data==='[DONE]')return;
          try{
            var evt=JSON.parse(data);
            if(evt.type==='text'&&evt.content){fullText+=evt.content;msgDiv.innerHTML=fullText}
            if(evt.type==='tool_start'){msgDiv.innerHTML=fullText+'<br><span style="font-size:10px;color:var(--text3)">🔧 กำลังดำเนินการ...</span>'}
          }catch(ex){}
        });
        var msgs=document.getElementById('co-messages');msgs.scrollTop=msgs.scrollHeight;
        readChunk();
      });
    }
    readChunk();
  }).catch(function(err){
    var e=document.getElementById('co-typing');if(e)e.remove();
    addCoMsg('agent','ขออภัยค่ะ ไม่สามารถเชื่อมต่อ AI ได้ กรุณาลองใหม่ค่ะ');
  });
}
function sendCoQuick(t){document.getElementById('co-input').value=t;sendCoMsg()}
// getCoReply removed — now handled by Agent Service API via sendCoMsg()
