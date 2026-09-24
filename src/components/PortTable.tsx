import { useMemo, type ReactNode } from "react";

import { PortRow, type PortGroup } from "@/components/PortRow";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useKill } from "@/hooks/useKill";
import { useSettings } from "@/stores/settingsStore";
import { useUi } from "@/stores/uiStore";
import type { PortInfo } from "@/types/system";

interface PortTableProps {
  ports: PortInfo[];
  /** Socket ids, so selection survives regrouping between refreshes. */
  selection?: Set<string>;
  onSelectionChange?: (next: Set<string>) => void;
  empty: ReactNode;
}

/**
 * One server usually binds the same port twice, once for IPv4 and once for
 * IPv6. To a person that is one thing listening, so it gets one row.
 */
function groupSockets(ports: PortInfo[]): PortGroup[] {
  const groups = new Map<string, PortGroup>();
  for (const socket of ports) {
    const key = `${socket.protocol}:${socket.port}:${socket.pid}:${socket.state}`;
    const group = groups.get(key);
    if (group) group.sockets.push(socket);
    else groups.set(key, { key, primary: socket, sockets: [socket] });
  }
  return [...groups.values()];
}

/** §34 — the ports table. Selection is optional so the dashboard can reuse it. */
export function PortTable({ ports, selection, onSelectionChange, empty }: PortTableProps) {
  const allowForceKill = useSettings((s) => s.settings.allowForceKill);
  const showUdp = useSettings((s) => s.settings.showUdp);
  const openDetails = useUi((s) => s.openDetails);
  const recentlyFreed = useUi((s) => s.recentlyFreed);
  const { killProcess } = useKill();

  const groups = useMemo(() => groupSockets(ports), [ports]);
  const selectable = Boolean(selection && onSelectionChange);
  const allSelected = useMemo(
    () => ports.length > 0 && ports.every((p) => selection?.has(p.id)),
    [ports, selection],
  );

  function toggleAll() {
    if (!onSelectionChange) return;
    onSelectionChange(allSelected ? new Set() : new Set(ports.map((p) => p.id)));
  }

  function toggleGroup(ids: string[], select: boolean) {
    if (!selection || !onSelectionChange) return;
    const next = new Set(selection);
    for (const id of ids) {
      if (select) next.add(id);
      else next.delete(id);
    }
    onSelectionChange(next);
  }

  if (!ports.length) {
    return <div className="px-4 py-14 text-center">{empty}</div>;
  }

  return (
    <Table>
      <TableHeader className="font-mono">
        <TableRow className="hover:bg-transparent">
          {/* Everything except Process is fixed width, so the one column that
              actually varies in length gets all the remaining space. */}
          {selectable && (
            <TableHead className="w-11 pl-4">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleAll}
                aria-label="Select every visible port"
              />
            </TableHead>
          )}
          <TableHead className="w-[84px] pl-4">port</TableHead>
          <TableHead>process</TableHead>
          <TableHead className="w-[80px]">pid</TableHead>
          {/* Without UDP every row is TCP, and a column that never changes is noise. */}
          {showUdp && <TableHead className="w-[60px]">proto</TableHead>}
          <TableHead className="w-[156px]">bind</TableHead>
          <TableHead className="w-[104px]">state</TableHead>
          <TableHead className="w-[104px] pr-3 text-right">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => (
          <PortRow
            key={group.key}
            group={group}
            showProtocol={showUdp}
            selectable={selectable}
            selected={group.sockets.every((s) => selection?.has(s.id))}
            onToggleSelect={toggleGroup}
            onDetails={openDetails}
            onKill={killProcess}
            allowForceKill={allowForceKill}
            justFreed={recentlyFreed.includes(group.primary.port)}
          />
        ))}
      </TableBody>
    </Table>
  );
}
