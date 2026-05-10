import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/stores/auth';
import { useTheme } from '@/stores/theme';
import { ChatWidget } from '@/components/ChatWidget';
import { useState, useEffect } from 'react';

const NAV_MENUS = [
  { key: 'dashboard', label: 'แดชบอร์ด', items: [{ to: '/dashboard', name: 'แดชบอร์ด' }] },
  { key: 'crm', label: 'CRM', items: [{ to: '/accounts', name: 'ลูกค้า' }] },
  { key: 'sales', label: 'การขาย', items: [{ to: '/leads', name: 'ไปป์ไลน์' }] },
  { key: 'activity', label: 'กิจกรรม', items: [{ to: '/tasks', name: 'งาน' }, { to: '/calendar', name: 'ปฏิทิน' }, { to: '/notifications', name: 'แจ้งเตือน' }] },
  { key: 'docs', label: 'เอกสาร', items: [{ to: '/quotations', name: 'ใบเสนอราคา' }, { to: '/products', name: 'สินค้า' }] },
  { key: 'marketing', label: 'Marketing', items: [{ to: '/marketing', name: 'Landing Page' }] },
];

export function AppLayout() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const initials = (user?.firstName?.[0] || '') + (user?.lastName?.[0] || '');
  const isAdmin = user?.role === 'Admin';
  const activeMenu = NAV_MENUS.find((m) => m.items.some((i) => location.pathname.startsWith(i.to)))?.key || '';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="bg-pattern" />

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', background: 'var(--nav-bg)', boxShadow: '0 1px 0 rgba(3,45,96,.15), 0 4px 20px rgba(3,45,96,.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, height: '100%' }}>
          {/* Mobile burger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{ display: 'none', width: 34, height: 34, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.7)', cursor: 'pointer', alignItems: 'center', justifyContent: 'center' }}
            className="mobile-burger"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>

          {/* Brand */}
          <NavLink
            to="/dashboard"
            style={{ textDecoration: 'none', fontSize: 17, fontWeight: 900, letterSpacing: '-0.6px', color: '#fff', paddingRight: 16, borderRight: '1px solid rgba(255,255,255,.1)', whiteSpace: 'nowrap' }}
          >
            SalesFAST <span style={{ color: '#4BCA81' }}>7</span>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.5)', marginLeft: 8 }}>IT Solutions</span>
          </NavLink>

          {/* Desktop nav */}
          <div style={{ display: 'flex', alignItems: 'center', height: '100%', gap: 2 }} className="desktop-nav">
            {NAV_MENUS.map((menu) => {
              const isActive = menu.key === activeMenu;
              if (menu.items.length === 1) {
                return (
                  <NavLink
                    key={menu.key}
                    to={menu.items[0].to}
                    style={{ display: 'flex', alignItems: 'center', height: '100%', padding: '0 14px', fontSize: 13, fontWeight: 500, color: isActive ? '#fff' : 'rgba(255,255,255,.65)', background: isActive ? 'rgba(255,255,255,.12)' : 'transparent', textDecoration: 'none', position: 'relative', transition: 'all .15s' }}
                    onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,.08)'; }}
                    onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.color = 'rgba(255,255,255,.65)'; e.currentTarget.style.background = 'transparent'; } }}
                  >
                    {menu.label}
                    {isActive && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: '#1B96FF', borderRadius: '2px 2px 0 0' }} />}
                  </NavLink>
                );
              }
              return (
                <div
                  key={menu.key}
                  style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center' }}
                  onMouseEnter={() => setOpenDropdown(menu.key)}
                  onMouseLeave={() => setOpenDropdown(null)}
                >
                  <button style={{ display: 'flex', alignItems: 'center', gap: 4, height: '100%', padding: '0 14px', fontSize: 13, fontWeight: 500, color: isActive ? '#fff' : 'rgba(255,255,255,.65)', background: isActive ? 'rgba(255,255,255,.12)' : 'transparent', border: 'none', cursor: 'pointer', position: 'relative', transition: 'all .15s', fontFamily: 'inherit' }}>
                    {menu.label}
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1.5 3L4 5.5L6.5 3"/></svg>
                    {isActive && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: '#1B96FF', borderRadius: '2px 2px 0 0' }} />}
                  </button>
                  {openDropdown === menu.key && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, minWidth: 220, background: 'var(--surface)', borderRadius: 10, boxShadow: '0 8px 32px rgba(3,45,96,.1), 0 2px 6px rgba(3,45,96,.04)', border: '1px solid var(--border)', padding: 6, zIndex: 200 }}>
                      {menu.items.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={() => setOpenDropdown(null)}
                          style={{ display: 'block', padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'var(--text)', textDecoration: 'none', transition: 'background .12s' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--row-hover)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          {item.name}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {isAdmin && (
              <NavLink
                to="/settings"
                style={{ display: 'flex', alignItems: 'center', height: '100%', padding: '0 14px', fontSize: 13, fontWeight: 500, color: location.pathname.startsWith('/settings') ? '#fff' : 'rgba(255,255,255,.65)', background: location.pathname.startsWith('/settings') ? 'rgba(255,255,255,.12)' : 'transparent', textDecoration: 'none', position: 'relative', transition: 'all .15s' }}
              >
                ตั้งค่า
                {location.pathname.startsWith('/settings') && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: '#1B96FF', borderRadius: '2px 2px 0 0' }} />}
              </NavLink>
            )}
          </div>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={toggle} style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.6)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'all .15s' }} title="Toggle theme">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
          </button>
          <NavLink to="/notifications" style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.6)', textDecoration: 'none' }} title="Notifications">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
          </NavLink>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', border: '2px solid rgba(255,255,255,.2)', cursor: 'pointer', background: 'linear-gradient(135deg, #1B96FF, #7F56D9)' }}
            title="Logout"
          >
            {initials || 'U'}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div style={{ position: 'fixed', top: 52, left: 0, right: 0, bottom: 0, background: 'var(--surface)', zIndex: 99, overflowY: 'auto', padding: 16 }}>
          {NAV_MENUS.map((menu) => (
            <div key={menu.key}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', padding: '16px 16px 6px' }}>{menu.label}</div>
              {menu.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  style={({ isActive }) => ({ display: 'block', padding: '12px 16px', borderRadius: 10, fontSize: 14, fontWeight: 500, color: isActive ? 'var(--sf-blue)' : 'var(--text)', background: isActive ? 'rgba(1,118,211,.06)' : 'transparent', textDecoration: 'none' })}
                >
                  {item.name}
                </NavLink>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      <main>
        <Outlet />
      </main>

      {/* Chat Widget */}
      <ChatWidget />

      {/* Responsive CSS */}
      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-burger { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
