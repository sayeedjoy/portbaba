import { useMemo } from "react";

import { PortRow } from "@/components/PortRow";
import { useKill } from "@/hooks/useKill";
import { useSettings } from "@/stores/settingsStore";
import { useUi } from "@/stores/uiStore";
import type { PortInfo } from "@/types/system";

interface PortTableProps {
  ports: PortInfo[];
  selection?: Set<string>;
  onSelectionChange?: (next: Set<string>) => void;
  empty: React.ReactNode;
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
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-hairline text-[13px] text-ink-muted">
            {selectable && (
              <th scope="col" className="w-9 pb-2 pl-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  aria-label="Select every visible port"
                  onChange={toggleAll}
                  className="h-3.5 w-3.5 accent-[var(--ink)]"
                />
              </th>
            )}
            <th scope="col" className="w-20 pb-2 pl-4 font-medium">
              Port
            </th>
            <th scope="col" className="pb-2 pr-4 font-medium">
              Process
            </th>
            <th scope="col" className="w-20 pb-2 pr-4 font-medium">
              PID
            </th>
            <th scope="col" className="w-20 pb-2 pr-4 font-medium">
              Protocol
            </th>
            <th scope="col" className="w-32 pb-2 pr-4 font-medium">
              Address
            </th>
            <th scope="col" className="w-32 pb-2 pr-4 font-medium">
              Status
            </th>
            <th scope="col" className="w-56 pb-2 pr-3 text-right font-medium">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
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
        </tbody>
      </table>
    </div>
  );
}
