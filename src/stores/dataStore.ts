import { create } from "zustand";

import * as api from "@/services/tauri";
import { scanOptions, useSettings } from "@/stores/settingsStore";
import type {
  FavoritePort,
  HistoryEntry,
  PortInfo,
  PortPreset,
  ProcessGroup,
} from "@/types/system";

interface DataState {
  ports: PortInfo[];
  groups: ProcessGroup[];
  favorites: FavoritePort[];
  presets: PortPreset[];
  history: HistoryEntry[];

  /** True only for the very first load, so refreshes never blank the table. */
  initialising: boolean;
  refreshing: boolean;
  error: string | null;
  lastScan: number | null;

  refresh: () => Promise<void>;
  loadLocalState: () => Promise<void>;
  reloadHistory: () => Promise<void>;
  setFavorites: (favorites: FavoritePort[]) => void;
  setPresets: (presets: PortPreset[]) => void;
}

let inFlight: Promise<void> | null = null;

export const useData = create<DataState>((set, get) => ({
  ports: [],
  groups: [],
  favorites: [],
  presets: [],
  history: [],

  initialising: true,
  refreshing: false,
  error: null,
  lastScan: null,

  /**
   * FR-009 / FR-010. Overlapping refreshes are coalesced: a 1-second auto
   * refresh must never queue scans faster than the OS can answer them.
   */
  async refresh() {
    if (inFlight) return inFlight;

    const options = scanOptions(useSettings.getState().settings);
    set({ refreshing: true });

    inFlight = (async () => {
      try {
        const [ports, groups] = await Promise.all([
          api.getActivePorts(options),
          api.getProcessGroups(options),
        ]);
        set({ ports, groups, error: null, lastScan: Date.now() });
      } catch (error) {
        // §51 — keep showing the last good table and say what went wrong.
        set({ error: error instanceof Error ? error.message : String(error) });
      } finally {
        set({ refreshing: false, initialising: false });
        inFlight = null;
      }
    })();

    return inFlight;
  },

  async loadLocalState() {
    const [favorites, presets, history] = await Promise.all([
      api.getFavorites().catch(() => []),
      api.getPresets().catch(() => []),
      api.getHistory().catch(() => []),
    ]);
    set({ favorites, presets, history });
  },

  async reloadHistory() {
    set({ history: await api.getHistory().catch(() => get().history) });
  },

  setFavorites: (favorites) => set({ favorites }),
  setPresets: (presets) => set({ presets }),
}));

/** FR-013 — which favourite ports are currently held, and by what. */
export function occupancyOf(ports: PortInfo[], port: number): PortInfo | undefined {
  return (
    ports.find((p) => p.port === port && p.state === "LISTEN") ??
    ports.find((p) => p.port === port)
  );
}
