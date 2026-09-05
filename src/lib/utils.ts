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
