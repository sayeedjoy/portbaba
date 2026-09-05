import type { ReactNode } from "react";
import {
  Clock,
  Gauge,
  Network,
  RefreshCw,
  Settings as SettingsIcon,
  Star,
  Terminal,
} from "lucide-react";

import { cn, shortcutLabel } from "@/lib/utils";
import { useData } from "@/stores/dataStore";
import { useUi, type Route } from "@/stores/uiStore";

const NAV: { route: Route; label: string; icon: typeof Gauge }[] = [
  { route: "dashboard", label: "Dashboard", icon: Gauge },
  { route: "ports", label: "Ports", icon: Network },
  { route: "processes", label: "Processes", icon: Terminal },
  { route: "favorites", label: "Favourites", icon: Star },
  { route: "history", label: "History", icon: Clock },
  { route: "settings", label: "Settings", icon: SettingsIcon },
];

/** §32 — the app's navigation, plus the status strip that answers "is this current?". */
export function AppShell({ children }: { children: ReactNode }) {
  const route = useUi((s) => s.route);
  const navigate = useUi((s) => s.navigate);
  const setPaletteOpen = useUi((s) => s.setPaletteOpen);
  const refresh = useData((s) => s.refresh);
  const refreshing = useData((s) => s.refreshing);
  const lastScan = useData((s) => s.lastScan);
  const error = useData((s) => s.error);
  const portCount = useData((s) => s.ports.length);

  return (
    <div className="flex h-full">
      <nav
        aria-label="Sections"
        className="flex w-[186px] shrink-0 flex-col border-r border-hairline bg-panel"
      >
        <div className="px-4 pt-5 pb-4">
          <p className="text-[15px] font-semibold tracking-[-0.01em]">Port Killer</p>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">
            {portCount} {portCount === 1 ? "port in use" : "ports in use"}
          </p>
        </div>

        <ul className="flex-1 px-2">
          {NAV.map(({ route: target, label, icon: Icon }) => (
            <li key={target}>
              <button
                type="button"
                onClick={() => navigate(target)}
                aria-current={route === target ? "page" : undefined}
                className={cn(
                  "mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left",
                  route === target
                    ? "bg-raised font-medium text-ink"
                    : "text-ink-soft hover:bg-raised hover:text-ink",
                )}
              >
                <Icon aria-hidden className="h-4 w-4 shrink-0" />
                {label}
              </button>
            </li>
          ))}
        </ul>

        <div className="border-t border-hairline p-2">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-ink-soft hover:bg-raised hover:text-ink"
          >
            Commands
            <kbd className="rounded border border-hairline bg-raised px-1.5 py-0.5 text-[11px] text-ink-muted">
              {shortcutLabel("Mod+K")}
            </kbd>
          </button>
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-hairline px-5">
          <p aria-live="polite" className="min-w-0 truncate text-[13px] text-ink-muted">
            {error ? (
              <span className="text-[var(--danger)]">{error}</span>
            ) : refreshing ? (
              "Scanning ports…"
            ) : lastScan ? (
              `Updated ${new Date(lastScan).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}`
            ) : (
              ""
            )}
          </p>

          <button
            type="button"
            onClick={() => void refresh()}
            className="flex h-8 shrink-0 items-center gap-2 rounded-lg border border-hairline bg-raised px-3 text-[13px] hover:border-hairline-strong"
          >
            <RefreshCw
              aria-hidden
              className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
            />
            Refresh
            <kbd className="text-[11px] text-ink-muted">{shortcutLabel("Mod+R")}</kbd>
          </button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

/** A page heading plus its controls. Every page uses the same rhythm. */
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold tracking-[-0.015em]">{title}</h1>
        {description && <p className="mt-0.5 text-ink-soft">{description}</p>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-hairline bg-panel shadow-[var(--shadow-panel)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

/** Empty states point at the next action rather than describing the void. */
export function Empty({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mx-auto max-w-sm">
      <p className="text-ink">{title}</p>
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}
