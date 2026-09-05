/**
 * The only place the frontend talks to Rust (SR-001).
 *
 * Every function here maps one-to-one onto a `#[tauri::command]`. Nothing in
 * the UI constructs a shell command, and nothing bypasses this module.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type {
  FavoritePort,
  HistoryEntry,
  KillResult,
  PortInfo,
  PortPreset,
  PortStatus,
  ProcessGroup,
  ProcessInfo,
  ScanOptions,
  Settings,
  SystemInfo,
} from "@/types/system";

/** Rust returns `Result<T, String>`; surface the message as a real Error. */
async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw new Error(typeof error === "string" ? error : String(error));
  }
}

// ---- ports ----------------------------------------------------------------

export const getActivePorts = (options: ScanOptions) =>
  call<PortInfo[]>("get_active_ports", { options });

export const getPortInfo = (port: number) => call<PortInfo[]>("get_port_info", { port });

export const checkPort = (port: number) => call<PortStatus>("check_port", { port });

export const checkPortRange = (start: number, end: number) =>
  call<PortStatus[]>("check_port_range", { start, end });

// ---- processes ------------------------------------------------------------

export const getProcessDetails = (pid: number) =>
  call<ProcessInfo>("get_process_details", { pid });

export const getProcessGroups = (options: ScanOptions) =>
  call<ProcessGroup[]>("get_process_groups", { options });

export const findProcessesByName = (name: string) =>
  call<ProcessGroup[]>("find_processes_by_name", { name });

// ---- termination ----------------------------------------------------------

export const killPort = (port: number, force = false) =>
  call<KillResult[]>("kill_port", { port, force });

export const killProcess = (pid: number) => call<KillResult>("kill_process", { pid });

export const forceKillProcess = (pid: number) =>
  call<KillResult>("force_kill_process", { pid });

export const killProcesses = (pids: number[], force = false) =>
  call<KillResult[]>("kill_processes", { pids, force });

export const killProcessesByName = (name: string, force = false) =>
  call<KillResult[]>("kill_processes_by_name", { name, force });

// ---- system and local state ----------------------------------------------

export const getSystemInfo = () => call<SystemInfo>("get_system_info");

export const getSettings = () => call<Settings>("get_settings");
export const saveSettings = (settings: Settings) =>
  call<Settings>("save_settings", { settings });

export const getFavorites = () => call<FavoritePort[]>("get_favorites");
export const addFavorite = (port: number, label: string, description?: string) =>
  call<FavoritePort[]>("add_favorite", { port, label, description });
export const removeFavorite = (id: string) => call<FavoritePort[]>("remove_favorite", { id });

export const getPresets = () => call<PortPreset[]>("get_presets");
export const savePresets = (presets: PortPreset[]) =>
  call<PortPreset[]>("save_presets", { presets });
export const resetPresets = () => call<PortPreset[]>("reset_presets");

export const getHistory = () => call<HistoryEntry[]>("get_history");
export const clearHistory = () => call<void>("clear_history");

export const revealDirectory = (path: string) => call<void>("reveal_directory", { path });

// ---- events ---------------------------------------------------------------

/** Emitted by Rust after any termination, including tray kills. */
export const onPortsChanged = (handler: () => void): Promise<UnlistenFn> =>
  listen("ports:changed", () => handler());

/** The tray's "Quick Kill Port…" item. */
export const onTrayQuickKill = (handler: () => void): Promise<UnlistenFn> =>
  listen("tray:quick-kill", () => handler());

/** The global shortcut (FR-025). */
export const onGlobalQuickKill = (handler: () => void): Promise<UnlistenFn> =>
  listen("shortcut:quick-kill", () => handler());

/** Raised when a configured shortcut cannot be registered. */
export const onShortcutError = (handler: (message: string) => void): Promise<UnlistenFn> =>
  listen<string>("shortcut:error", (event) => handler(event.payload));

/** Raised when a setting could not be applied to the system (e.g. the login item). */
export const onSettingsError = (handler: (message: string) => void): Promise<UnlistenFn> =>
  listen<string>("settings:error", (event) => handler(event.payload));
