import { memo } from "react";
import { MoreHorizontal } from "lucide-react";

import { ProtectedTag, StateTag } from "@/components/app/StateTag";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
 * One socket, on one line.
 *
 * The process name and its project share a row rather than stacking, so every
 * row is the same height — a table of forty ports is much easier to scan when
 * the rhythm is even.
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
  const project = port.project
    ? port.project.framework
      ? `${port.project.framework} in ${port.project.name}`
      : port.project.name
    : null;

  return (
    <TableRow
      data-state={selected ? "selected" : undefined}
      className={cn("group", justFreed && "animate-freed")}
    >
      {selectable && (
        <TableCell className="pl-4">
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect(port.id)}
            aria-label={`Select ${port.processName} on port ${port.port}`}
          />
        </TableCell>
      )}

      <TableCell className="pl-4 text-[15px] font-semibold tabular-nums">
        {port.port}
      </TableCell>

      <TableCell className="max-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 truncate">{port.processName}</span>
          {port.protected && <ProtectedTag className="shrink-0" />}
          {/* FR-018 — the project is what identifies an abandoned dev server.
              It truncates before the process name does. */}
          {project && (
            <span className="min-w-0 truncate text-[13px] text-ink-muted">{project}</span>
          )}
        </div>
      </TableCell>

      <TableCell className="tabular-nums text-ink-soft">{port.pid || "—"}</TableCell>
      <TableCell className="text-ink-soft">{port.protocol}</TableCell>
      <TableCell className="font-mono text-[12.5px] text-ink-soft">
        {port.address}
      </TableCell>
      <TableCell>
        <StateTag state={state} />
      </TableCell>

      <TableCell className="pr-3">
        {port.pid > 0 ? (
          // Always visible, because an action that only appears on hover is one
          // most people never find — but quiet, because a filled button
          // repeated down forty rows turns a destructive action into wallpaper.
          <div className="flex items-center justify-end gap-0.5">
            <Button
              size="sm"
              variant="ghost"
              className="text-ink-soft hover:bg-[var(--danger-wash)] hover:text-[var(--danger)]"
              onClick={() => onKill(port, false)}
            >
              Terminate
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`More actions for ${port.processName} on port ${port.port}`}
                >
                  <MoreHorizontal aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onDetails(port.pid)}>
                  Process details
                </DropdownMenuItem>
                {allowForceKill && (
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => onKill(port, true)}
                  >
                    Force kill
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          // §49 — the socket is real but its owner is not ours to see.
          <p className="text-right text-[13px] text-ink-muted">Owner not visible</p>
        )}
      </TableCell>
    </TableRow>
  );
});
