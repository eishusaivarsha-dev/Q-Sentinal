import { create } from "zustand";

interface UiState {
  presenter: boolean;
  step: number;
  startedAt: number | null;
  menu: boolean;
  openPresenter(): void;
  closePresenter(): void;
  goStep(n: number): void;
  setMenu(open: boolean): void;
}

export const useUi = create<UiState>((set) => ({
  presenter: false,
  step: 0,
  startedAt: null,
  menu: false,
  openPresenter: () => set({ presenter: true, step: 0, startedAt: Date.now() }),
  closePresenter: () => set({ presenter: false, startedAt: null }),
  goStep: (step) => set({ step }),
  setMenu: (menu) => set({ menu }),
}));
