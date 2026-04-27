/* SalesFAST 7 — Shared Helpers */
function fmt(n){if(n>=1e6)return'\u0E3F'+(n/1e6).toFixed(1)+'M';if(n>=1e3)return'\u0E3F'+(n/1e3).toFixed(0)+'K';return'\u0E3F'+n.toLocaleString()}
function toggleTheme(){const h=document.documentElement;const t=h.getAttribute('data-theme')==='light'?'dark':'light';h.setAttribute('data-theme',t);localStorage.setItem('ppcrm-theme',t)}
function initTheme(){const t=localStorage.getItem('ppcrm-theme')||'light';document.documentElement.setAttribute('data-theme',t)}
