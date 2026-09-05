import { cn } from "@/lib/utils";
import type { PortState } from "@/types/system";

/**
 * FR-013 — the five states, each with its own colour. Occupied states are the
 * loud ones because they are the ones that need action; "available" is
 * deliberately quiet.
 */
const STATES: Record<PortState, { label: string; className: string }> = {
  available: {
    label: "Available",
    className: "text-[var(--free)] bg-[var(--free-wash)]",
  },
  listening: {
    label: "Listening",
    className: "text-[var(--occupied)] bg-[var(--occupied-wash)]",
  },
  established: {
    label: "Established",
    className: "text-ink-soft bg-raised",
  },
  occupied: {
    label: "Occupied",
    className: "text-[var(--occupied)] bg-[var(--occupied-wash)]",
  },
  unknown: {
    label: "Unknown owner",
    className: "text-ink-muted bg-raised",
  },
};

export function StateTag({ state, className }: { state: PortState; className?: string }) {
  const { label, className: tone } = STATES[state];
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center rounded-md px-2 text-[12.5px] font-medium",
        tone,
        className,
      )}
    >
      {label}
    </span>
  );
}

/** FR-008 — a system process is flagged wherever it appears. */
export function ProtectedTag({ className }: { className?: string }) {
  return (
    <span
      title="System process — Port Killer will not terminate this by default"
      className={cn(
        "inline-flex h-[22px] items-center rounded-md bg-[var(--protected-wash)] px-2 text-[12.5px] font-medium text-[var(--protected)]",
        className,
      )}
    >
      System
    </span>
  );
}
