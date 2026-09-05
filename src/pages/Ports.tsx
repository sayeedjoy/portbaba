import { forwardRef, useEffect, useMemo, useRef, useState } from "react";

import { Empty, PageHeader, Panel } from "@/components/AppShell";
import { PortTable } from "@/components/PortTable";
import { SearchBar, type SearchHandle } from "@/components/SearchBar";
import { Button } from "@/components/ui/button";
import { StateTag } from "@/components/app/StateTag";
import { useFilteredPorts } from "@/hooks/usePorts";
import { useKill } from "@/hooks/useKill";
import { parseRange, pluralise } from "@/lib/utils";
import * as api from "@/services/tauri";
import { useData } from "@/stores/dataStore";
import { useSettings } from "@/stores/settingsStore";
import { useUi } from "@/stores/uiStore";
import type { PortStatus } from "@/types/system";

/** §34 — the full table, with multi-select (FR-019) and range scanning (FR-021). */
export const Ports = forwardRef<SearchHandle>(function Ports(_props, ref) {
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const ports = useData((s) => s.ports);
  const initialising = useData((s) => s.initialising);
  const settings = useSettings((s) => s.settings);
  const updateSettings = useSettings((s) => s.update);
  const toast = useUi((s) => s.toast);
  const { killSelection } = useKill();

  const filtered = useFilteredPorts(query);
  const range = useMemo(() => parseRange(query), [query]);

  // Drop selections whose ports have gone away between refreshes.
  useEffect(() => {
    setSelection((current) => {
      if (!current.size) return current;
      const live = new Set(ports.map((p) => p.id));
      const next = new Set([...current].filter((id) => live.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [ports]);

  const selected = ports.filter((p) => selection.has(p.id));

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <PageHeader
        title="Ports"
        description={`${pluralise(ports.length, "socket")} in use on this machine`}
      >
        <SearchBar ref={ref} value={query} onChange={setQuery} className="w-[320px]" />
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterChip
          active={settings.showUdp}
          onClick={() => void updateSettings({ showUdp: !settings.showUdp })}
        >
          UDP
        </FilterChip>
        <FilterChip
          active={settings.showEstablished}
          onClick={() =>
            void updateSettings({ showEstablished: !settings.showEstablished })
          }
        >
          Established connections
        </FilterChip>

        {selected.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[13px] text-ink-muted">
              {pluralise(selected.length, "port")} selected
            </span>
            {settings.allowForceKill && (
              <Button size="sm" onClick={() => killSelection(selected, true)}>
                Force kill
              </Button>
            )}
            <Button
              size="sm"
              variant="destructive"
              onClick={() => killSelection(selected, false)}
            >
              Kill selected
            </Button>
          </div>
        )}
      </div>

      {/* FR-021 — a range in the search box scans the range instead of filtering. */}
      {range ? (
        <RangeResults
          start={range[0]}
          end={range[1]}
          onError={(message) => toast("danger", message)}
        />
      ) : (
        <Panel>
          <PortTable
            ports={filtered}
            selection={selection}
            onSelectionChange={setSelection}
            empty={
              <Empty
                title={
                  initialising
                    ? "Reading the socket table…"
                    : query
                      ? `Nothing matches “${query}”.`
                      : "No ports are in use. Turn on UDP or established connections to widen the scan."
                }
              />
            }
          />
        </Panel>
      )}
    </div>
  );
});

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "h-8 rounded-lg border border-transparent bg-ink px-3 text-[13px] font-medium text-panel"
          : "h-8 rounded-lg border border-hairline bg-raised px-3 text-[13px] text-ink-soft hover:border-hairline-strong hover:text-ink"
      }
    >
      {children}
    </button>
  );
}

function RangeResults({
  start,
  end,
  onError,
}: {
  start: number;
  end: number;
  onError: (message: string) => void;
}) {
  const [results, setResults] = useState<PortStatus[] | null>(null);
  const [loading, setLoading] = useState(true);
  const openDetails = useUi((s) => s.openDetails);
  const { killPort } = useKill();

  // The caller passes a fresh closure on every render. Holding it in a ref keeps
  // it out of the dependency array, so the scan runs when the range changes and
  // not once per render.
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const timer = window.setTimeout(() => {
      api
        .checkPortRange(start, end)
        .then((data) => {
          if (!cancelled) setResults(data);
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setResults([]);
            onErrorRef.current(error instanceof Error ? error.message : String(error));
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [start, end]);

  const occupied = results?.filter((r) => !r.available) ?? [];

  return (
    <Panel className="p-5">
      <p className="text-ink-soft">
        {loading
          ? `Scanning ${start} to ${end}…`
          : `${pluralise(occupied.length, "port")} in use between ${start} and ${end}.`}
      </p>

      {!loading && results && (
        <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-1.5">
          {results.map((result) => {
            const holder = result.entries[0];
            return (
              <div
                key={result.port}
                className={
                  result.available
                    ? "rounded-lg border border-hairline px-2.5 py-2"
                    : "rounded-lg border border-[var(--occupied)]/45 bg-[var(--occupied-wash)] px-2.5 py-2"
                }
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={
                      result.available
                        ? "font-semibold text-ink-muted"
                        : "font-semibold text-[var(--occupied)]"
                    }
                  >
                    {result.port}
                  </span>
                  {!result.available && (
                    <button
                      type="button"
                      onClick={() => killPort(result.port)}
                      className="text-[12px] text-[var(--danger)] hover:underline"
                    >
                      Kill
                    </button>
                  )}
                </div>
                {holder ? (
                  <button
                    type="button"
                    onClick={() => openDetails(holder.pid)}
                    className="mt-0.5 block w-full truncate text-left text-[12.5px] text-ink-soft hover:text-ink"
                  >
                    {holder.processName}
                  </button>
                ) : (
                  <StateTag state="available" className="mt-1" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
