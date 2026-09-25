import { create } from "zustand";

interface UiState {
  presenter: boolean;
  setPresenter(open: boolean): void;
}

export const useUi = create<UiState>((set) => ({
  presenter: false,
  setPresenter: (presenter) => set({ presenter }),
}));
