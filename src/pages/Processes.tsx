import { useState } from "react";

import { Empty, PageHeader, Panel } from "@/components/AppShell";
import { SearchBar } from "@/components/SearchBar";
import { Button } from "@/components/ui/button";
import { ProtectedTag } from "@/components/app/StateTag";
import { useKill } from "@/hooks/useKill";
import { pluralise, truncateStart } from "@/lib/utils";
import { useData } from "@/stores/dataStore";
import { useSettings } from "@/stores/settingsStore";
import { useUi } from "@/stores/uiStore";

/** §35 — ports grouped under the process that owns them, plus FR-020. */
export function Processes() {
  const [query, setQuery] = useState("");
  const groups = useData((s) => s.groups);
  const ports = useData((s) => s.ports);
  const initialising = useData((s) => s.initialising);
  const allowForceKill = useSettings((s) => s.settings.allowForceKill);
  const openDetails = useUi((s) => s.openDetails);
  const { killSelection, killByName } = useKill();

  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? groups.filter(
        (g) =>
          g.name.toLowerCase().includes(needle) ||
          String(g.pid) === needle ||
          g.ports.some((p) => String(p.port).startsWith(needle)) ||
          g.project?.name.toLowerCase().includes(needle),
      )
    : groups;

  // FR-020 — offer the bulk action only when there is genuinely more than one.
  const names = [...new Set(filtered.map((g) => g.name))];
  const bulkName = names.length === 1 && filtered.length > 1 ? names[0] : null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <PageHeader
        title="Processes"
        description={`${pluralise(groups.length, "process", "processes")} holding a port`}
      >
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search a process or port"
          className="w-[300px]"
        />
      </PageHeader>

      {bulkName && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-panel px-4 py-3">
          <p className="text-ink-soft">
            {pluralise(filtered.length, `${bulkName} process`, `${bulkName} processes`)} are
            holding{" "}
            {pluralise(
              filtered.reduce((total, g) => total + g.ports.length, 0),
              "port",
            )}
            .
          </p>
          <Button
            size="sm"
            variant="destructive"
            onClick={() =>
              killByName(
                bulkName,
                ports.filter((p) => p.processName === bulkName),
              )
            }
          >
            Kill every {bulkName} process
          </Button>
        </div>
      )}

      {filtered.length === 0 ? (
        <Panel className="px-4 py-14 text-center">
          <Empty
            title={
              initialising
                ? "Reading the process table…"
                : query
                  ? `No process matches “${query}”.`
                  : "Nothing is holding a port right now."
            }
          />
        </Panel>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((group) => (
            <Panel key={group.pid} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-[16px] font-semibold">{group.name}</h2>
                    {group.protected && <ProtectedTag />}
                  </div>

                  <p className="mt-0.5 text-[13px] text-ink-muted">
                    PID {group.pid}
                    {group.user && ` — ${group.user}`}
                  </p>

                  {group.project && (
                    <p className="mt-1 truncate text-[13px] text-ink-soft">
                      {group.project.framework
                        ? `${group.project.framework} in ${group.project.name}`
                        : group.project.name}
                    </p>
                  )}

                  {/* FR-017 — the command is often the only way to tell two
                      node servers apart. */}
                  {group.command && (
                    <p
                      className="selectable mt-1.5 truncate font-mono text-[12px] text-ink-muted"
                      title={group.command}
                    >
                      {truncateStart(group.command, 96)}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => openDetails(group.pid)}>
                    Details
                  </Button>
                  {allowForceKill && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => killSelection(group.ports, true)}
                    >
                      Force
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => killSelection(group.ports, false)}
                  >
                    Terminate
                  </Button>
                </div>
              </div>

              <ul className="mt-3 flex flex-wrap gap-1.5">
                {group.ports.map((port) => (
                  <li
                    key={port.id}
                    className="rounded-md bg-raised px-2 py-1 text-[13px]"
                    title={`${port.protocol} on ${port.address} — ${port.state}`}
                  >
                    <span className="font-semibold">{port.port}</span>
                    <span className="ml-1.5 text-ink-muted">{port.protocol}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
