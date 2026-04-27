/* SalesFAST 7 — Shared Navigation */
function renderNav(activePage){
  const links=[
    {id:'dashboard',label:'Dashboard'},
    {id:'accounts',label:'Accounts'},
    {id:'contacts',label:'Contacts'},
    {id:'leads',label:'Leads'},
    {id:'opportunities',label:'Opportunities'},
    {id:'tasks',label:'Tasks'},
    {id:'calendar',label:'Calendar'},
    {id:'quotations',label:'Quotations'},
    {id:'products',label:'Products'},
    {id:'notifications',label:'Notifications'},
    {id:'settings',label:'Settings'},
  ];
  const navLinksHtml=links.map(l=>`<a href="${l.id}.html" class="nav-link${activePage===l.id?' active':''}">${l.label}</a>`).join('');
  return `<nav class="glass-nav">
    <div class="nav-left">
      <a href="dashboard.html" class="nav-brand">SalesFAST <span style="color:#2E844A">7</span></a>
      <div class="nav-links">${navLinksHtml}</div>
    </div>
    <div class="nav-right">
      <button class="icon-btn" id="theme-icon" onclick="toggleTheme()" title="Toggle theme"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg></button>
      <a href="notifications.html" class="icon-btn" title="Notifications"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg></a>
      <div class="nav-avatar" style="font-size:7px;letter-spacing:-.2px">SF<span style="color:#4BCA81">7</span></div>
    </div>
  </nav>`;
}
document.addEventListener('DOMContentLoaded',()=>initTheme());
