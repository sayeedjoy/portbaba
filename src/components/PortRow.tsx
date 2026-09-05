import { memo } from "react";

import { ProtectedTag, StateTag } from "@/components/app/StateTag";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TableCell, TableRow } from "@/components/ui/table";
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
 * device carrying information, so the row can be scanned without reading the
 * status column.
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
    <TableRow
      data-state={selected ? "selected" : undefined}
      className={cn("group", justFreed && "animate-freed")}
      style={
        state === "listening" || state === "occupied"
          ? { boxShadow: "inset 3px 0 0 var(--occupied)" }
          : state === "unknown"
            ? { boxShadow: "inset 3px 0 0 var(--hairline-strong)" }
            : undefined
      }
    >
      {selectable && (
        <TableCell className="w-9 pl-3">
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect(port.id)}
            aria-label={`Select ${port.processName} on port ${port.port}`}
          />
        </TableCell>
      )}

      <TableCell className="pl-4 text-[15px] font-semibold">{port.port}</TableCell>

      <TableCell className="max-w-0">
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
      </TableCell>

      <TableCell className="text-ink-soft">{port.pid || "—"}</TableCell>
      <TableCell className="text-ink-soft">{port.protocol}</TableCell>
      <TableCell className="font-mono text-[12.5px] text-ink-soft">
        {port.address}
      </TableCell>
      <TableCell>
        <StateTag state={state} />
      </TableCell>

      <TableCell className="pr-3">
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
              <Button size="sm" variant="outline" onClick={() => onKill(port, false)}>
                Terminate
              </Button>
            </>
          ) : (
            // §49 — the socket is real but its owner is not ours to see.
            <span className="pr-1 text-[13px] text-ink-muted">Owner not visible</span>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
});
