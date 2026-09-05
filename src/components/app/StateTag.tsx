import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
    className: "border-transparent bg-[var(--free-wash)] text-[var(--free)]",
  },
  listening: {
    label: "Listening",
    className:
      "border-transparent bg-[var(--occupied-wash)] text-[var(--occupied)]",
  },
  established: {
    label: "Established",
    className: "border-transparent bg-raised text-ink-soft",
  },
  occupied: {
    label: "Occupied",
    className:
      "border-transparent bg-[var(--occupied-wash)] text-[var(--occupied)]",
  },
  unknown: {
    label: "Unknown owner",
    className: "border-transparent bg-raised text-ink-muted",
  },
};

export function StateTag({ state, className }: { state: PortState; className?: string }) {
  const { label, className: tone } = STATES[state];
  return (
    <Badge variant="outline" className={cn("font-medium", tone, className)}>
      {label}
    </Badge>
  );
}

/** FR-008 — a system process is flagged wherever it appears. */
export function ProtectedTag({ className }: { className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            "border-transparent bg-[var(--protected-wash)] font-medium text-[var(--protected)]",
            className,
          )}
        >
          System
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        The operating system depends on this process. Port Killer will not
        terminate it unless you turn off protection in Settings → Safety.
      </TooltipContent>
    </Tooltip>
  );
}
