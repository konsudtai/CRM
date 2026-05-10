/* SalesFAST 7 — Shared Helpers */
function fmt(n){if(n>=1e6)return'\u0E3F'+(n/1e6).toFixed(1)+'M';if(n>=1e3)return'\u0E3F'+(n/1e3).toFixed(0)+'K';return'\u0E3F'+n.toLocaleString()}
function toggleTheme(){const h=document.documentElement;const t=h.getAttribute('data-theme')==='light'?'dark':'light';h.setAttribute('data-theme',t);localStorage.setItem('sf7-theme',t)}
function initTheme(){const t=localStorage.getItem('sf7-theme')||'light';document.documentElement.setAttribute('data-theme',t)}

/* XSS sanitization — escape HTML entities in user-provided strings */
function esc(s){if(s==null)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

/* Safe innerHTML setter — sanitizes content before rendering */
function safeHtml(el,html){if(typeof el==='string')el=document.getElementById(el);if(el)el.innerHTML=html}

/* Auth token helpers */
function getToken(){return localStorage.getItem('sf7_token')}
function setToken(t){localStorage.setItem('sf7_token',t)}
function clearToken(){localStorage.removeItem('sf7_token');localStorage.removeItem('sf7_user')}
function requireAuth(){if(!getToken()){window.location.href='../login.html';return false}return true}

/* Simple toast notification */
function toast(msg, type) {
  var t = document.getElementById('sf7-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'sf7-toast';
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 20px;border-radius:10px;font-size:13px;font-weight:600;color:#fff;box-shadow:0 12px 32px rgba(0,0,0,.2);transform:translateY(100px);opacity:0;transition:all .3s;max-width:400px;display:flex;align-items:center;gap:10px';
    document.body.appendChild(t);
  }
  t.style.background = type === 'error' ? '#DC2626' : '#10B981';
  t.innerHTML = '<span style="font-size:16px">' + (type === 'error' ? '&#10005;' : '&#10003;') + '</span><span>' + esc(msg) + '</span>';
  t.style.transform = 'translateY(0)';
  t.style.opacity = '1';
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(function() {
    t.style.transform = 'translateY(100px)';
    t.style.opacity = '0';
  }, 3000);
}
window.toast = toast;
