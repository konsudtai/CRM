import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  commandPaletteOpen: boolean;
  activeModal: string | null;
  toggleSidebar: () => void;
  toggleCommandPalette: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  openModal: (id: string) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  commandPaletteOpen: false,
  activeModal: null,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
  setCommandPaletteOpen: (open: boolean) => set({ commandPaletteOpen: open }),
  openModal: (id: string) => set({ activeModal: id }),
  closeModal: () => set({ activeModal: null }),
}));
