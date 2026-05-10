import { create } from 'zustand';

interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  roles: string[];
  phone?: string;
  avatarUrl?: string;
}

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  login: (token: string, user: UserProfile) => void;
  logout: () => void;
  setUser: (user: UserProfile) => void;
}

export const useAuth = create<AuthState>((set) => ({
  token: localStorage.getItem('sf7_token'),
  user: (() => {
    try { return JSON.parse(localStorage.getItem('sf7-user') || 'null'); } catch { return null; }
  })(),
  isAuthenticated: !!localStorage.getItem('sf7_token'),

  login: (token, user) => {
    localStorage.setItem('sf7_token', token);
    localStorage.setItem('sf7-user', JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('sf7_token');
    localStorage.removeItem('sf7-user');
    set({ token: null, user: null, isAuthenticated: false });
  },

  setUser: (user) => {
    localStorage.setItem('sf7-user', JSON.stringify(user));
    set({ user });
  },
}));
