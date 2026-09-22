import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import type { PortInfo, PortState } from "@/types/system";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** SR-002 — the same 1–65535 rule the backend enforces, applied as you type. */
export function parsePort(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d{1,5}$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value >= 1 && value <= 65535 ? value : null;
}

/** FR-021 — "3000-3100" or "3000..3100". */
export function parseRange(input: string): [number, number] | null {
  const match = input.trim().match(/^(\d{1,5})\s*(?:-|\.\.|to)\s*(\d{1,5})$/);
  if (!match) return null;
  const start = parsePort(match[1]);
  const end = parsePort(match[2]);
  if (start === null || end === null) return null;
  return start <= end ? [start, end] : [end, start];
}

/** FR-013 — collapse a socket into the five states the UI shows. */
export function portState(entry: PortInfo): PortState {
  if (entry.ownerUnknown) return "unknown";
  switch (entry.state) {
    case "LISTEN":
      return "listening";
    case "ESTABLISHED":
      return "established";
    case "UDP":
      return "occupied";
    default:
      return "occupied";
  }
}

/**
 * Runtimes, servers and databases a developer starts on purpose, keyed by
 * executable name without its extension, with the name people know them by.
 * Matched in full, so "node" does not catch "nodejs-updater".
 */
const DEV_PROCESSES = new Map<string, string>([
  // Language runtimes and toolchains
  ["node", "Node.js"], ["bun", "Bun"], ["deno", "Deno"], ["python", "Python"],
  ["python3", "Python"], ["pythonw", "Python"], ["py", "Python"],
  ["java", "Java"], ["javaw", "Java"], ["go", "Go"], ["dotnet", ".NET"],
  ["ruby", "Ruby"], ["php", "PHP"], ["php-cgi", "PHP"], ["perl", "Perl"],
  ["elixir", "Elixir"], ["beam.smp", "Erlang VM"], ["erl", "Erlang VM"],
  ["cargo", "Rust"], ["rustc", "Rust"], ["esbuild", "esbuild"], ["hugo", "Hugo"],
  // Containers and WSL port forwarding
  ["docker", "Docker"], ["dockerd", "Docker"], ["com.docker.backend", "Docker"],
  ["com.docker.proxy", "Docker"], ["vpnkit", "Docker"], ["containerd", "Docker"],
  ["wslrelay", "WSL"], ["podman", "Podman"],
  // Databases and local infrastructure
  ["postgres", "PostgreSQL"], ["mysqld", "MySQL"], ["mariadbd", "MariaDB"],
  ["sqlservr", "SQL Server"], ["redis-server", "Redis"], ["mongod", "MongoDB"],
  ["memurai", "Redis (Memurai)"], ["memcached", "Memcached"],
  ["elasticsearch", "Elasticsearch"], ["rabbitmq-server", "RabbitMQ"],
  ["minio", "MinIO"], ["nginx", "nginx"], ["httpd", "Apache"], ["caddy", "Caddy"],
  ["traefik", "Traefik"], ["grafana-server", "Grafana"], ["ngrok", "ngrok"],
]);

export function devRuntime(entry: PortInfo): string | undefined {
  const name = entry.processName.toLowerCase().replace(/\.exe$/, "");
  if (/^python\d+(\.\d+)?$/.test(name)) return "Python";
  return DEV_PROCESSES.get(name);
}

/**
 * Whether a socket belongs to development work, for the "Dev only" view.
 * A detected framework wins; otherwise the owning executable decides. OS
 * processes never count, even if they happen to match a name.
 */
export function isDevPort(entry: PortInfo): boolean {
  if (entry.protected) return false;
  return Boolean(entry.project?.framework || devRuntime(entry));
}

/**
 * What the process is, in the words a developer would use: "Vite in portbaba",
 * "PostgreSQL". The project wins because it identifies a forgotten dev server;
 * the runtime name covers services started without a readable working folder.
 */
export function describeOwner(entry: PortInfo): string | null {
  const project = entry.project;
  if (project?.framework) return `${project.framework} in ${project.name}`;
  if (project) return project.name;
  return devRuntime(entry) ?? null;
}

export type Reach = "local" | "everywhere" | "specific";

/**
 * Who can connect, which is what the bind address actually means: loopback is
 * this computer only, a wildcard is every network the machine is on.
 */
export function reachOf(address: string): Reach {
  const bare = address.replace(/^\[|\]$/g, "");
  if (bare === "0.0.0.0" || bare === "::" || bare === "*") return "everywhere";
  if (bare === "::1" || bare.startsWith("127.") || bare === "localhost") return "local";
  return "specific";
}

const RELATIVE = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

/** "5 minutes ago" — the form FR-016 asks for. */
export function relativeTime(seconds: number): string {
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 30],
    ["month", 12],
  ];
  let value = Math.max(0, Math.round(seconds));
  for (const [unit, size] of units) {
    if (value < size) return RELATIVE.format(-value, unit);
    value = Math.round(value / size);
  }
  return RELATIVE.format(-value, "year");
}

export function formatClock(millis: number): string {
  return new Date(millis).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(millis: number): string {
  const date = new Date(millis);
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  if (sameDay) return "Today";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/** Long paths read better with the tail intact — that's the informative part. */
export function truncateStart(text: string, max = 48): string {
  return text.length <= max ? text : `…${text.slice(text.length - max + 1)}`;
}

export const isMac = navigator.platform.toLowerCase().includes("mac");

/** Render a shortcut the way the host platform writes it. */
export function shortcutLabel(keys: string): string {
  return isMac
    ? keys.replace(/\bMod\b/g, "⌘").replace(/\bShift\b/g, "⇧").replace(/\+/g, "")
    : keys.replace(/\bMod\b/g, "Ctrl");
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
