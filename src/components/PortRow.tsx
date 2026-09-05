import { memo } from "react";

import { Button } from "@/components/ui/Button";
import { ProtectedTag, StateTag } from "@/components/ui/StateTag";
import { cn, portState } from "@/lib/utils";
import type { PortInfo } from "@/types/system";

interface PortRowProps {
  port: PortInfo;
  selectable: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onDetails: (pid: number) => void;
  onKill: (port: PortInfo, force: boolean) => void;
  allowForceKill: boolean;
  /** Flashes once when this port has just been freed. */
  justFreed: boolean;
}

/**
 * One socket. The coloured spine on the left is the state — a structural
 * device carrying information, so the row needs no separate status column
 * to scan quickly.
 */
export const PortRow = memo(function PortRow({
  port,
  selectable,
  selected,
  onToggleSelect,
  onDetails,
  onKill,
  allowForceKill,
  justFreed,
}: PortRowProps) {
  const state = portState(port);

  return (
    <tr
      className={cn(
        "group border-b border-hairline last:border-b-0",
        "hover:bg-raised",
        selected && "bg-raised",
        justFreed && "animate-freed",
      )}
      style={
        state === "listening" || state === "occupied"
          ? { boxShadow: "inset 3px 0 0 var(--occupied)" }
          : state === "unknown"
            ? { boxShadow: "inset 3px 0 0 var(--hairline-strong)" }
            : undefined
      }
    >
      {selectable && (
        <td className="w-9 pl-3">
          <input
            type="checkbox"
            checked={selected}
            aria-label={`Select ${port.processName} on port ${port.port}`}
            onChange={() => onToggleSelect(port.id)}
            className="h-3.5 w-3.5 accent-[var(--ink)]"
          />
        </td>
      )}

      <td className="py-2.5 pl-4 text-[15px] font-semibold">{port.port}</td>

      <td className="max-w-0 py-2.5 pr-4">
        <div className="flex items-center gap-2">
          <span className="truncate">{port.processName}</span>
          {port.protected && <ProtectedTag />}
        </div>
        {/* FR-018 — the project is what actually identifies an abandoned server. */}
        {port.project && (
          <p className="truncate text-[12.5px] text-ink-muted">
            {port.project.framework
              ? `${port.project.framework} in ${port.project.name}`
              : port.project.name}
          </p>
        )}
      </td>

      <td className="py-2.5 pr-4 text-ink-soft">{port.pid || "—"}</td>
      <td className="py-2.5 pr-4 text-ink-soft">{port.protocol}</td>
      <td className="py-2.5 pr-4 font-mono text-[12.5px] text-ink-soft">{port.address}</td>
      <td className="py-2.5 pr-4">
        <StateTag state={state} />
      </td>

      <td className="py-2.5 pr-3">
        <div className="flex justify-end gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          {port.pid > 0 ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => onDetails(port.pid)}>
                Details
              </Button>
              {allowForceKill && (
                <Button size="sm" variant="ghost" onClick={() => onKill(port, true)}>
                  Force
                </Button>
              )}
              <Button size="sm" variant="quiet" onClick={() => onKill(port, false)}>
                Terminate
              </Button>
            </>
          ) : (
            // §49 — the socket is real but its owner is not ours to see.
            <span className="pr-1 text-[13px] text-ink-muted">
              Owner not visible
            </span>
          )}
        </div>
      </td>
    </tr>
  );
});
