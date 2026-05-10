import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/stores/auth';
import { useTheme } from '@/stores/theme';
import { motion } from 'framer-motion';
import { useState } from 'react';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'แดชบอร์ด' },
  { to: '/accounts', label: 'CRM' },
  { to: '/leads', label: 'การขาย' },
  { to: '/tasks', label: 'กิจกรรม' },
  { to: '/quotations', label: 'เอกสาร' },
  { to: '/marketing', label: 'Marketing' },
  { to: '/settings', label: 'ตั้งค่า', adminOnly: true },
];

export function AppLayout() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = (user?.firstName?.[0] || '') + (user?.lastName?.[0] || '');
  const isAdmin = user?.role === 'Admin';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 h-[52px] flex items-center justify-between px-5 bg-gradient-to-r from-sf-navy-d via-sf-blue-d to-sf-blue shadow-lg">
        <div className="flex items-center gap-5 h-full">
          {/* Brand */}
          <NavLink to="/dashboard" className="flex items-center gap-2 text-white no-underline">
            <span className="text-[17px] font-black tracking-tight">
              SalesFAST <span className="text-emerald-400">7</span>
            </span>
            <span className="text-[11px] font-medium text-white/50 ml-1">IT Solutions</span>
          </NavLink>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center h-full gap-0.5">
            {NAV_ITEMS.filter((n) => !n.adminOnly || isAdmin).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `h-full flex items-center px-3.5 text-[13px] font-medium transition-colors relative ${
                    isActive
                      ? 'text-white bg-white/12'
                      : 'text-white/65 hover:text-white hover:bg-white/8'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {item.label}
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute bottom-0 left-0 right-0 h-[3px] bg-sky-400 rounded-t"
                        transition={{ duration: 0.25 }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition"
            title="Toggle theme"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

          {/* User avatar */}
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-400 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white border-2 border-white/20 hover:scale-110 transition"
            title="Logout"
          >
            {initials || 'U'}
          </button>

          {/* Mobile burger */}
          <button
            className="md:hidden w-8 h-8 flex flex-col items-center justify-center gap-1"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <span className="w-5 h-0.5 bg-white/70 rounded" />
            <span className="w-5 h-0.5 bg-white/70 rounded" />
            <span className="w-5 h-0.5 bg-white/70 rounded" />
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-1"
        >
          {NAV_ITEMS.filter((n) => !n.adminOnly || isAdmin).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `px-4 py-2.5 rounded-lg text-sm font-medium ${
                  isActive ? 'bg-sf-blue/10 text-sf-blue' : 'text-slate-700 hover:bg-slate-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </motion.div>
      )}

      {/* Main content */}
      <main>
        <Outlet />
      </main>
    </div>
  );
}
