import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/stores/auth';
import { useTheme } from '@/stores/theme';
import { ChatWidget } from '@/components/ChatWidget';
import { useState } from 'react';

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
  const { toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const initials = (user?.firstName?.[0] || '') + (user?.lastName?.[0] || '');
  const isAdmin = user?.role === 'Admin';

  // Find active menu
  const activeMenu = NAV_MENUS.find((m) => m.items.some((i) => location.pathname.startsWith(i.to)))?.key || '';

  return (
    <div>
      <div className="bg-pattern" />

      {/* ── Nav (matches vanilla sf7-nav exactly) ── */}
      <nav
        className="sticky top-0 z-[100] h-[52px] flex items-center justify-between px-5"
        style={{ background: 'var(--nav-bg)', boxShadow: '0 1px 0 rgba(3,45,96,.15), 0 4px 20px rgba(3,45,96,.12)' }}
      >
        <div className="flex items-center gap-5 h-full">
          {/* Mobile burger */}
          <button
            className="md:hidden w-[34px] h-[34px] rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>

          {/* Brand */}
          <NavLink
            to="/dashboard"
            className="text-[17px] font-black tracking-[-0.6px] text-white pr-4 border-r border-white/10 whitespace-nowrap no-underline hover:no-underline"
          >
            SalesFAST <span className="text-[#4BCA81]">7</span>
            <span className="text-[11px] font-medium text-white/50 ml-2">IT Solutions</span>
          </NavLink>

          {/* Desktop nav items */}
          <div className="hidden md:flex items-center h-full gap-0.5">
            {NAV_MENUS.filter(() => true).map((menu) => {
              const isActive = menu.key === activeMenu;
              if (menu.items.length === 1) {
                return (
                  <NavLink
                    key={menu.key}
                    to={menu.items[0].to}
                    className={`flex items-center h-full px-3.5 text-[13px] font-medium transition-all relative no-underline hover:no-underline ${
                      isActive ? 'text-white bg-white/[.12]' : 'text-white/65 hover:text-white hover:bg-white/[.08]'
                    }`}
                  >
                    {menu.label}
                    {isActive && <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#1B96FF] rounded-t" />}
                  </NavLink>
                );
              }
              return (
                <div
                  key={menu.key}
                  className="relative h-full flex items-center"
                  onMouseEnter={() => setOpenDropdown(menu.key)}
                  onMouseLeave={() => setOpenDropdown(null)}
                >
                  <button
                    className={`flex items-center gap-1 h-full px-3.5 text-[13px] font-medium transition-all relative border-none bg-transparent cursor-pointer ${
                      isActive ? 'text-white bg-white/[.12]' : 'text-white/65 hover:text-white hover:bg-white/[.08]'
                    }`}
                  >
                    {menu.label}
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1.5 3L4 5.5L6.5 3"/></svg>
                    {isActive && <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#1B96FF] rounded-t" />}
                  </button>
                  {openDropdown === menu.key && (
                    <div className="absolute top-full left-0 min-w-[200px] bg-[var(--surface)] rounded-[10px] shadow-lg border border-[var(--border)] p-1.5 z-[200]">
                      {menu.items.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={() => setOpenDropdown(null)}
                          className="block px-3 py-2 rounded-lg text-[13px] font-medium text-[var(--text)] hover:bg-[var(--row-hover)] no-underline hover:no-underline"
                        >
                          {item.name}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {/* Settings (admin only) */}
            {isAdmin && (
              <NavLink
                to="/settings"
                className={`flex items-center h-full px-3.5 text-[13px] font-medium transition-all relative no-underline hover:no-underline ${
                  location.pathname.startsWith('/settings') ? 'text-white bg-white/[.12]' : 'text-white/65 hover:text-white hover:bg-white/[.08]'
                }`}
              >
                ตั้งค่า
                {location.pathname.startsWith('/settings') && <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#1B96FF] rounded-t" />}
              </NavLink>
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition border-none bg-transparent cursor-pointer"
            title="Toggle theme"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
          </button>

          {/* User avatar */}
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-white/20 cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #1B96FF, #7F56D9)' }}
            title="Logout"
          >
            {initials || 'U'}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden fixed top-[52px] left-0 right-0 bottom-0 bg-[var(--surface)] z-[99] overflow-y-auto p-4">
          {NAV_MENUS.map((menu) => (
            <div key={menu.key}>
              <div className="text-[10px] font-bold text-[var(--text3)] uppercase tracking-[1px] px-4 pt-4 pb-1.5">{menu.label}</div>
              {menu.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `block px-4 py-3 rounded-[10px] text-sm font-medium no-underline hover:no-underline ${
                      isActive ? 'bg-[rgba(1,118,211,.06)] text-[var(--sf-blue)]' : 'text-[var(--text)] hover:bg-[var(--row-hover)]'
                    }`
                  }
                >
                  {item.name}
                </NavLink>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Main content */}
      <main>
        <Outlet />
      </main>

      {/* Chat Widget */}
      <ChatWidget />
    </div>
  );
}
