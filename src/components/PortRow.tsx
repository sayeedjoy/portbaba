import { memo } from "react";
import { Info, MoreHorizontal, Zap } from "lucide-react";

import { ProcessIcon } from "@/components/app/ProcessIcon";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, describeOwner, portState, reachOf } from "@/lib/utils";
import type { PortInfo } from "@/types/system";

/** Every socket one process holds on one port, shown as a single row. */
export interface PortGroup {
  key: string;
  primary: PortInfo;
  sockets: PortInfo[];
}

interface PortRowProps {
  group: PortGroup;
  showProtocol: boolean;
  selectable: boolean;
  selected: boolean;
  onToggleSelect: (ids: string[], select: boolean) => void;
  onDetails: (pid: number) => void;
  onKill: (port: PortInfo, force: boolean) => void;
  allowForceKill: boolean;
  /** Flashes once when this port has just been freed. */
  justFreed: boolean;
}

/**
 * One listening server, on one line.
 *
 * The process name and its project share a row rather than stacking, so every
 * row is the same height — a table of forty ports is much easier to scan when
 * the rhythm is even.
 */
export const PortRow = memo(function PortRow({
  group,
  showProtocol,
  selectable,
  selected,
  onToggleSelect,
  onDetails,
  onKill,
  allowForceKill,
  justFreed,
}: PortRowProps) {
  const port = group.primary;
  const state = portState(port);
  const owner = describeOwner(port);
  const addresses = group.sockets.map((s) => s.address);

  return (
    <TableRow
      data-state={selected ? "selected" : undefined}
      className={cn("group", justFreed && "animate-freed")}
    >
      {selectable && (
        <TableCell className="pl-4">
          <Checkbox
            checked={selected}
            onCheckedChange={() =>
              onToggleSelect(
                group.sockets.map((s) => s.id),
                !selected,
              )
            }
            aria-label={`Select ${port.processName} on port ${port.port}`}
          />
        </TableCell>
      )}

      <TableCell className="pl-4 font-mono text-[14px] font-semibold">
        <span aria-hidden className="font-normal text-ink-muted">
          :
        </span>
        {port.port}
      </TableCell>

      <TableCell className="max-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <ProcessIcon entry={port} />
          {/* FR-018 — what it is comes first; the executable is the detail. */}
          {owner ? (
            <>
              <span className="shrink-0 truncate font-medium">{owner}</span>
              <span className="min-w-0 truncate font-mono text-[12px] text-ink-muted">
                {port.processName}
              </span>
            </>
          ) : (
            <span className="shrink-0 truncate font-mono">{port.processName}</span>
          )}
          {port.protected && <ProtectedTag className="shrink-0" />}
        </div>
      </TableCell>

      <TableCell className="font-mono text-ink-soft">{port.pid || "—"}</TableCell>
      {showProtocol && (
        <TableCell className="font-mono text-ink-soft">{port.protocol.toLowerCase()}</TableCell>
      )}
      <TableCell>
        <ReachLabel addresses={addresses} />
      </TableCell>
      <TableCell>
        <StateTag state={state} />
      </TableCell>

      <TableCell className="pr-3">
        {port.pid > 0 ? (
          // Always visible, because an action that only appears on hover is one
          // most people never find. A soft red wash marks it as destructive;
          // it only turns solid under the pointer, so forty rows stay calm.
          <div className="flex items-center justify-end gap-0.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 bg-[var(--danger-wash)] px-2.5 text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white"
              onClick={() => onKill(port, false)}
              aria-label={`Kill ${port.processName} on port ${port.port}`}
            >
              Kill
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="size-7"
                  aria-label={`More actions for ${port.processName} on port ${port.port}`}
                >
                  <MoreHorizontal aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onDetails(port.pid)}>
                  <Info aria-hidden />
                  Process details
                </DropdownMenuItem>
                {allowForceKill && (
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => onKill(port, true)}
                  >
                    <Zap aria-hidden />
                    Force kill
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          // §49 — the socket is real but its owner is not ours to see.
          <p className="text-right text-[12px] text-ink-muted">owner hidden</p>
        )}
      </TableCell>
    </TableRow>
  );
});

/**
 * The bind address itself, as a developer would read it in netstat. The widest
 * one is shown, because it decides who can connect: a server on both
 * 127.0.0.1 and 0.0.0.0 is reachable from the network. The tooltip says what
 * that means in words, and lists every address the row stands for.
 */
function ReachLabel({ addresses }: { addresses: string[] }) {
  const reaches = addresses.map(reachOf);
  const shown =
    addresses[reaches.indexOf("everywhere")] ??
    addresses[reaches.indexOf("specific")] ??
    addresses[0];
  const exposed = reaches.includes("everywhere");
  const extra = new Set(addresses).size - 1;
  const hint = exposed
    ? "Other devices on your network can connect."
    : reaches.includes("specific")
      ? "Reachable on this one interface."
      : "Only programs on this computer can connect.";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex min-w-0 cursor-default items-baseline gap-1.5 font-mono text-[12.5px]">
          <span className={cn("truncate", exposed ? "text-ink" : "text-ink-soft")}>
            {shown}
          </span>
          {extra > 0 && <span className="shrink-0 text-ink-muted">+{extra}</span>}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        <p className="text-[12.5px]">{hint}</p>
        <p className="mt-1 font-mono text-[12px] opacity-80">{addresses.join("  ")}</p>
      </TooltipContent>
    </Tooltip>
  );
}
