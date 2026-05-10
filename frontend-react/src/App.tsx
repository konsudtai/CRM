import { Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { AuthGuard } from '@/components/AuthGuard';
import { AppLayout } from '@/layouts/AppLayout';
import { LandingPage } from '@/pages/Landing';
import { LoginPage } from '@/pages/Login';
import { DashboardPage } from '@/pages/Dashboard';
import { AccountsPage } from '@/pages/Accounts';
import { LeadsPage } from '@/pages/Leads';
import { TasksPage } from '@/pages/Tasks';
import { ContactsPage } from '@/pages/Contacts';
import { QuotationsPage } from '@/pages/Quotations';
import { ProductsPage } from '@/pages/Products';
import { SettingsPage } from '@/pages/Settings';
import { MarketingPage } from '@/pages/Marketing';
import { CalendarPage } from '@/pages/Calendar';
import { NotificationsPage } from '@/pages/Notifications';

export default function App() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Protected CRM */}
        <Route element={<AuthGuard><AppLayout /></AuthGuard>}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/quotations" element={<QuotationsPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/marketing" element={<MarketingPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AnimatePresence>
  );
}
