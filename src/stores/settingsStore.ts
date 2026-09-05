import { create } from "zustand";

import * as api from "@/services/tauri";
import type { Settings, SystemInfo, ThemeChoice } from "@/types/system";

const FALLBACK: Settings = {
  launchAtStartup: false,
  startMinimized: false,
  closeToTray: false,
  autoRefresh: true,
  refreshInterval: 5,
  showUdp: false,
  showEstablished: false,
  confirmBeforeKill: true,
  allowForceKill: true,
  protectSystemProcesses: true,
  theme: "system",
  notifications: true,
  globalShortcutEnabled: false,
  globalShortcut: "Ctrl+Shift+K",
};

interface SettingsState {
  settings: Settings;
  system: SystemInfo | null;
  loaded: boolean;
  load: () => Promise<void>;
  /** Optimistic: the toggle moves immediately, then persists. */
  update: (patch: Partial<Settings>) => Promise<void>;
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: FALLBACK,
  system: null,
  loaded: false,

  async load() {
    const [settings, system] = await Promise.all([
      api.getSettings().catch(() => FALLBACK),
      api.getSystemInfo().catch(() => null),
    ]);
    applyTheme(settings.theme);
    set({ settings, system, loaded: true });
  },

  async update(patch) {
    const next = { ...get().settings, ...patch };
    if (patch.theme) applyTheme(patch.theme);
    set({ settings: next });
    try {
      const saved = await api.saveSettings(next);
      applyTheme(saved.theme);
      set({ settings: saved });
    } catch {
      // Persisting failed; the in-memory value still reflects what the user
      // asked for, and the next load will show the truth.
    }
  },
}));

/** "system" means: follow the OS, so remove the override entirely. */
export function applyTheme(theme: ThemeChoice) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

export const scanOptions = (settings: Settings) => ({
  includeUdp: settings.showUdp,
  includeEstablished: settings.showEstablished,
});
