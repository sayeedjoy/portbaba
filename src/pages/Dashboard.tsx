import { forwardRef } from "react";

import { Empty, Panel } from "@/components/AppShell";
import { PortBerth } from "@/components/PortBerth";
import { PortTable } from "@/components/PortTable";
import { QuickKill, type QuickKillHandle } from "@/components/QuickKill";
import { useKill } from "@/hooks/useKill";
import { occupancyOf, useData } from "@/stores/dataStore";
import { useUi } from "@/stores/uiStore";

/** §33 — the screen you open when a port is busy. */
export const Dashboard = forwardRef<QuickKillHandle>(function Dashboard(_props, ref) {
  const ports = useData((s) => s.ports);
  const favorites = useData((s) => s.favorites);
  const initialising = useData((s) => s.initialising);
  const navigate = useUi((s) => s.navigate);
  const openDetails = useUi((s) => s.openDetails);
  const recentlyFreed = useUi((s) => s.recentlyFreed);
  const { killPort } = useKill();

  const listening = ports.filter((p) => p.state === "LISTEN");
  const shown = listening.slice(0, 8);

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <QuickKill ref={ref} />

      {favorites.length > 0 && (
        <section className="mt-7" aria-labelledby="favorites-heading">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 id="favorites-heading" className="font-medium">
              Favourites
            </h2>
            <button
              type="button"
              onClick={() => navigate("favorites")}
              className="text-[13px] text-ink-muted hover:text-ink"
            >
              Manage
            </button>
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(158px,1fr))] gap-2.5">
            {favorites.map((favorite) => (
              <PortBerth
                key={favorite.id}
                favorite={favorite}
                holder={occupancyOf(ports, favorite.port)}
                onFree={killPort}
                onInspect={openDetails}
                justFreed={recentlyFreed.includes(favorite.port)}
              />
            ))}
          </div>
        </section>
      )}

      <section className="mt-7" aria-labelledby="active-heading">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 id="active-heading" className="font-medium">
            Listening now
          </h2>
          {listening.length > shown.length && (
            <button
              type="button"
              onClick={() => navigate("ports")}
              className="text-[13px] text-ink-muted hover:text-ink"
            >
              See all {listening.length}
            </button>
          )}
        </div>

        <Panel>
          <PortTable
            ports={shown}
            empty={
              <Empty
                title={
                  initialising
                    ? "Reading the socket table…"
                    : "Nothing is listening on this machine right now."
                }
              />
            }
          />
        </Panel>
      </section>
    </div>
  );
});
