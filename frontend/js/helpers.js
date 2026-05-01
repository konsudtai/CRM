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
