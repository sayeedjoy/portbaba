import { useMemo, type ReactNode } from "react";

import { PortRow } from "@/components/PortRow";
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
  selection?: Set<string>;
  onSelectionChange?: (next: Set<string>) => void;
  empty: ReactNode;
}

/** §34 — the ports table. Selection is optional so the dashboard can reuse it. */
export function PortTable({ ports, selection, onSelectionChange, empty }: PortTableProps) {
  const allowForceKill = useSettings((s) => s.settings.allowForceKill);
  const openDetails = useUi((s) => s.openDetails);
  const recentlyFreed = useUi((s) => s.recentlyFreed);
  const { killProcess } = useKill();

  const selectable = Boolean(selection && onSelectionChange);
  const allSelected = useMemo(
    () => ports.length > 0 && ports.every((p) => selection?.has(p.id)),
    [ports, selection],
  );

  function toggleAll() {
    if (!onSelectionChange) return;
    onSelectionChange(allSelected ? new Set() : new Set(ports.map((p) => p.id)));
  }

  function toggleOne(id: string) {
    if (!selection || !onSelectionChange) return;
    const next = new Set(selection);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  }

  if (!ports.length) {
    return <div className="px-4 py-14 text-center">{empty}</div>;
  }

  return (
    <Table>
      <TableHeader>
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
          <TableHead className="w-[76px] pl-4">Port</TableHead>
          <TableHead>Process</TableHead>
          <TableHead className="w-[76px]">PID</TableHead>
          <TableHead className="w-[68px]">Protocol</TableHead>
          <TableHead className="w-[116px]">Address</TableHead>
          <TableHead className="w-[112px]">Status</TableHead>
          <TableHead className="w-[152px] pr-3 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ports.map((port) => (
          <PortRow
            key={port.id}
            port={port}
            selectable={selectable}
            selected={selection?.has(port.id) ?? false}
            onToggleSelect={toggleOne}
            onDetails={openDetails}
            onKill={killProcess}
            allowForceKill={allowForceKill}
            justFreed={recentlyFreed.includes(port.port)}
          />
        ))}
      </TableBody>
    </Table>
  );
}
