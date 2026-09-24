import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PortState } from "@/types/system";

/**
 * FR-013 — the five states, each with its own colour, written the short way
 * netstat writes them. Occupied states are the loud ones because they are the
 * ones that need action; "free" is deliberately quiet.
 */
const STATES: Record<PortState, { label: string; tone: string; dot: string }> = {
  available: { label: "free", tone: "text-[var(--free)]", dot: "bg-[var(--free)]" },
  listening: {
    label: "listen",
    tone: "text-[var(--occupied)]",
    dot: "bg-[var(--occupied)]",
  },
  established: { label: "estab", tone: "text-ink-soft", dot: "bg-ink-muted" },
  occupied: { label: "in use", tone: "text-[var(--occupied)]", dot: "bg-[var(--occupied)]" },
  unknown: { label: "no owner", tone: "text-ink-muted", dot: "border border-ink-muted" },
};

export function StateTag({ state, className }: { state: PortState; className?: string }) {
  const { label, tone, dot } = STATES[state];
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 font-mono text-[12px] whitespace-nowrap", tone, className)}
    >
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", dot)} />
      {label}
    </span>
  );
}

/** FR-008 — a system process is flagged wherever it appears. */
export function ProtectedTag({ className }: { className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex h-[18px] cursor-default items-center rounded-sm border border-[var(--protected)]/40 bg-[var(--protected-wash)] px-1.5 font-mono text-[11px] text-[var(--protected)]",
            className,
          )}
        >
          system
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-[12.5px]">
        The operating system depends on this process. Port Baba will not
        terminate it unless you turn off protection in Settings → Safety.
      </TooltipContent>
    </Tooltip>
  );
}
