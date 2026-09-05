import { create } from "zustand";
import { toast as sonner } from "sonner";

import type { KillResult, PortInfo } from "@/types/system";

export type Route =
  | "dashboard"
  | "ports"
  | "processes"
  | "favorites"
  | "history"
  | "settings";

/** What a confirmation dialog needs to know (FR-007). */
export interface KillRequest {
  kind: "port" | "process" | "selection" | "name";
  /** Human summary shown as the dialog's subject. */
  title: string;
  port?: number;
  pid?: number;
  pids?: number[];
  name?: string;
  processName?: string;
  /** Pre-flight warnings: unsaved work, protected processes, bulk size. */
  targets: PortInfo[];
  force: boolean;
}

export type ToastTone = "success" | "danger" | "info";

interface UiState {
  route: Route;
  navigate: (route: Route) => void;

  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;

  /** PID whose detail panel is open (FR-016). */
  detailsPid: number | null;
  openDetails: (pid: number) => void;
  closeDetails: () => void;

  killRequest: KillRequest | null;
  requestKill: (request: KillRequest) => void;
  dismissKill: () => void;

  /** Ports freed in the last moment, used for the one flash of motion. */
  recentlyFreed: number[];
  markFreed: (ports: number[]) => void;

  /** Reports an outcome to the user. Rendered by sonner. */
  toast: (tone: ToastTone, message: string) => void;
  /** Turns kill results into the right number of toasts. */
  reportResults: (results: KillResult[]) => void;
}

let freedGeneration = 0;

export const useUi = create<UiState>((set, get) => ({
  route: "dashboard",
  navigate: (route) => set({ route, paletteOpen: false }),

  paletteOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),

  detailsPid: null,
  openDetails: (detailsPid) => set({ detailsPid }),
  closeDetails: () => set({ detailsPid: null }),

  killRequest: null,
  requestKill: (killRequest) => set({ killRequest }),
  dismissKill: () => set({ killRequest: null }),

  recentlyFreed: [],
  markFreed: (ports) => {
    if (!ports.length) return;
    const generation = ++freedGeneration;
    set({ recentlyFreed: ports });
    window.setTimeout(() => {
      // Only clear if no newer flash has started in the meantime.
      if (generation === freedGeneration) set({ recentlyFreed: [] });
    }, 1600);
  },

  toast: (tone, message) => {
    // Failures stay up longer: they usually name a next step, such as needing
    // elevation or switching to Force Kill.
    const options = { duration: tone === "danger" ? 7000 : 4500 };
    if (tone === "success") sonner.success(message, options);
    else if (tone === "danger") sonner.error(message, options);
    else sonner(message, options);
  },

  reportResults: (results) => {
    if (!results.length) return;
    const freed = results
      .filter((r) => r.success && typeof r.port === "number")
      .map((r) => r.port as number);
    get().markFreed(freed);

    if (results.length === 1) {
      const [only] = results;
      get().toast(only.success ? "success" : "danger", only.message);
      return;
    }

    const failures = results.filter((r) => !r.success);
    const succeeded = results.length - failures.length;
    if (!failures.length) {
      get().toast("success", `${succeeded} of ${results.length} processes terminated.`);
      return;
    }
    get().toast(
      "danger",
      `${succeeded} of ${results.length} terminated. ${failures[0].message}`,
    );
  },
}));
