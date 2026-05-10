import { Navigate } from 'react-router-dom';
import { useAuth } from '@/stores/auth';
import { type ReactNode } from 'react';

export function AuthGuard({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuth((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
