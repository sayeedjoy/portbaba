/** Mirrors the Rust models in `src-tauri/src/models` (SRS §46, §47). */

export type Protocol = "TCP" | "UDP";

export interface ProjectInfo {
  directory: string;
  name: string;
  framework?: string;
}

export interface PortInfo {
  /** Stable row key: protocol:address:port:pid */
  id: string;
  port: number;
  pid: number;
  processName: string;
  protocol: Protocol;
  address: string;
  state: string;
  executable?: string;
  command?: string;
  user?: string;
  /** FR-008 — terminating this would put the OS at risk. */
  protected: boolean;
  /** The socket is real but its owner is not visible to us. */
  ownerUnknown: boolean;
  project?: ProjectInfo;
}

export interface PortStatus {
  port: number;
  available: boolean;
  entries: PortInfo[];
}

export type KillOutcome =
  | "terminated"
  | "alreadyFree"
  | "vanished"
  | "permissionDenied"
  | "blocked"
  | "failed";

export interface KillResult {
  success: boolean;
  pid: number;
  port?: number;
  processName?: string;
  message: string;
  outcome: KillOutcome;
  forced: boolean;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  parentPid?: number;
  executable?: string;
  command?: string;
  user?: string;
  cwd?: string;
  /** Unix epoch seconds. */
  startedAt?: number;
  /** Seconds since start. */
  runTime?: number;
  memoryBytes: number;
  protected: boolean;
  project?: ProjectInfo;
  ports: number[];
}

export interface ProcessGroup {
  pid: number;
  name: string;
  executable?: string;
  command?: string;
  user?: string;
  protected: boolean;
  project?: ProjectInfo;
  ports: PortInfo[];
}

export interface SystemInfo {
  os: string;
  arch: string;
  hostname?: string;
  osVersion?: string;
  elevated: boolean;
  appVersion: string;
}

export interface ScanOptions {
  includeUdp: boolean;
  includeEstablished: boolean;
}

export type ThemeChoice = "system" | "light" | "dark";

export interface Settings {
  launchAtStartup: boolean;
  startMinimized: boolean;
  closeToTray: boolean;

  autoRefresh: boolean;
  /** Seconds between refreshes (FR-010). */
  refreshInterval: number;
  showUdp: boolean;
  showEstablished: boolean;

  confirmBeforeKill: boolean;
  allowForceKill: boolean;
  protectSystemProcesses: boolean;

  theme: ThemeChoice;

  notifications: boolean;
  globalShortcutEnabled: boolean;
  globalShortcut: string;
}

export interface FavoritePort {
  id: string;
  port: number;
  label: string;
  description: string;
}

export interface PortPreset {
  id: string;
  port: number;
  name: string;
  category: string;
}

export interface HistoryEntry {
  id: string;
  /** Unix epoch milliseconds. */
  timestamp: number;
  port?: number;
  pid: number;
  processName: string;
  action: string;
  result: string;
  message: string;
}

/** FR-013 — how a port reads at a glance. */
export type PortState = "available" | "listening" | "established" | "occupied" | "unknown";
