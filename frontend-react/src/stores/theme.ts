import { create } from 'zustand';

interface ThemeState {
  theme: 'light' | 'dark';
  toggle: () => void;
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: (localStorage.getItem('sf7-theme') as 'light' | 'dark') || 'light',
  toggle: () => {
    const next = get().theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('sf7-theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    set({ theme: next });
  },
}));
