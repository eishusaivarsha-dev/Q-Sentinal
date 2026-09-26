import { create } from "zustand";

export type Theme = "light" | "dark";

function savedTheme(): Theme {
  const t = document.documentElement.dataset.theme;
  return t === "dark" ? "dark" : "light";
}

interface UiState {
  presenter: boolean;
  step: number;
  startedAt: number | null;
  menu: boolean;
  theme: Theme;
  copilot: boolean;
  copilotDraft: string;
  openPresenter(): void;
  closePresenter(): void;
  goStep(n: number): void;
  setMenu(open: boolean): void;
  setTheme(t: Theme): void;
  toggleTheme(): void;
  openCopilot(draft?: string): void;
  closeCopilot(): void;
}

export const useUi = create<UiState>((set, get) => ({
  presenter: false,
  step: 0,
  startedAt: null,
  menu: false,
  theme: savedTheme(),
  copilot: false,
  copilotDraft: "",
  openPresenter: () => set({ presenter: true, step: 0, startedAt: Date.now() }),
  closePresenter: () => set({ presenter: false, startedAt: null }),
  goStep: (step) => set({ step }),
  setMenu: (menu) => set({ menu }),
  setTheme: (theme) => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#050812" : "#f0f3f8");
    try {
      localStorage.setItem("qs-theme", theme);
    } catch {
      /* storage blocked: the choice lasts for this page only */
    }
    set({ theme });
  },
  toggleTheme: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
  openCopilot: (draft = "") => set({ copilot: true, copilotDraft: draft }),
  closeCopilot: () => set({ copilot: false }),
}));

/** Resolved RGB colours of the theme tokens, for canvas / WebGL code that can't use CSS vars. */
export function themeColor(token: string, alpha = 1): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim();
  const [r, g, b] = raw.split(/\s+/).map(Number);
  return alpha === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function themeHex(token: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim();
  return "#" + raw.split(/\s+/).map((n) => Number(n).toString(16).padStart(2, "0")).join("");
}
