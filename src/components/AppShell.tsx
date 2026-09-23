import { useEffect, useState, type ReactNode } from "react";
import {
  Clock,
  Gauge,
  Info,
  Moon,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  Settings as SettingsIcon,
  Star,
  Sun,
  Terminal,
} from "lucide-react";

import appIcon from "../../src-tauri/icons/128x128.png";
import { useResolvedTheme } from "@/hooks/useResolvedTheme";
import { cn, shortcutLabel } from "@/lib/utils";
import { useData } from "@/stores/dataStore";
import { useSettings } from "@/stores/settingsStore";
import { useUi, type Route } from "@/stores/uiStore";

const NAV: { route: Route; label: string; icon: typeof Gauge }[] = [
  { route: "dashboard", label: "Dashboard", icon: Gauge },
  { route: "ports", label: "Ports", icon: Network },
  { route: "processes", label: "Processes", icon: Terminal },
  { route: "favorites", label: "Favourites", icon: Star },
  { route: "history", label: "History", icon: Clock },
  { route: "settings", label: "Settings", icon: SettingsIcon },
];

const footerButton =
  "flex w-full items-center gap-2.5 rounded-lg py-2 text-ink-soft hover:bg-raised hover:text-ink";

/** §32 — the app's navigation, plus the status strip that answers "is this current?". */
export function AppShell({ children }: { children: ReactNode }) {
  const route = useUi((s) => s.route);
  const navigate = useUi((s) => s.navigate);
  const setPaletteOpen = useUi((s) => s.setPaletteOpen);
  const setAboutOpen = useUi((s) => s.setAboutOpen);
  const updateSettings = useSettings((s) => s.update);
  const resolvedTheme = useResolvedTheme();
  const refresh = useData((s) => s.refresh);
  const refreshing = useData((s) => s.refreshing);
  const lastScan = useData((s) => s.lastScan);
  const error = useData((s) => s.error);
  const portCount = useData((s) => s.ports.length);
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const toggleSidebar = useUi((s) => s.toggleSidebar);

  return (
    <div className="flex h-full">
      <nav
        aria-label="Sections"
        className={cn(
          "flex shrink-0 flex-col overflow-hidden border-r border-hairline bg-panel transition-[width] duration-200",
          collapsed ? "w-[60px]" : "w-[186px]",
        )}
      >
        <div className={cn("flex items-center gap-2.5 pt-5 pb-4", collapsed ? "px-3.5" : "px-4")}>
          <img src={appIcon} alt="" className="size-8 shrink-0" draggable={false} />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold tracking-[-0.01em]">Port Baba</p>
              <p className="mt-0.5 truncate text-[12.5px] text-ink-muted">
                {portCount} {portCount === 1 ? "port in use" : "ports in use"}
              </p>
            </div>
          )}
        </div>

        <ul className="flex-1 px-2">
          {NAV.map(({ route: target, label, icon: Icon }) => (
            <li key={target}>
              <button
                type="button"
                onClick={() => navigate(target)}
                aria-current={route === target ? "page" : undefined}
                aria-label={collapsed ? label : undefined}
                title={collapsed ? label : undefined}
                className={cn(
                  "mb-0.5 flex w-full items-center gap-2.5 rounded-lg py-2 text-left",
                  collapsed ? "justify-center" : "px-2.5",
                  route === target
                    ? "bg-raised font-medium text-ink"
                    : "text-ink-soft hover:bg-raised hover:text-ink",
                )}
              >
                <Icon aria-hidden className="h-4 w-4 shrink-0" />
                {!collapsed && label}
              </button>
            </li>
          ))}
        </ul>

        <div className="border-t border-hairline p-2">
          <button
            type="button"
            onClick={() =>
              void updateSettings({ theme: resolvedTheme === "dark" ? "light" : "dark" })
            }
            aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} theme`}
            title={collapsed ? (resolvedTheme === "dark" ? "Light mode" : "Dark mode") : undefined}
            className={cn(footerButton, collapsed ? "justify-center" : "px-2.5", "mb-0.5")}
          >
            {resolvedTheme === "dark" ? (
              <Sun aria-hidden className="h-4 w-4 shrink-0" />
            ) : (
              <Moon aria-hidden className="h-4 w-4 shrink-0" />
            )}
            {!collapsed && (resolvedTheme === "dark" ? "Light mode" : "Dark mode")}
          </button>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label={collapsed ? "Search" : undefined}
            title={collapsed ? `Search (${shortcutLabel("Mod+K")})` : undefined}
            className={cn(footerButton, collapsed ? "justify-center" : "px-2.5", "mb-0.5")}
          >
            <Search aria-hidden className="h-4 w-4 shrink-0" />
            {!collapsed && (
              <>
                Search
                <kbd className="ml-auto rounded border border-hairline bg-raised px-1.5 py-0.5 text-[11px] text-ink-muted">
                  {shortcutLabel("Mod+K")}
                </kbd>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setAboutOpen(true)}
            aria-label={collapsed ? "About" : undefined}
            title={collapsed ? "About" : undefined}
            className={cn(footerButton, collapsed ? "justify-center" : "px-2.5")}
          >
            <Info aria-hidden className="h-4 w-4 shrink-0" />
            {!collapsed && "About"}
          </button>
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-hairline px-5">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              title={`${collapsed ? "Expand" : "Collapse"} sidebar (${shortcutLabel("Mod+B")})`}
              className="-ml-2 flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-soft hover:bg-raised hover:text-ink"
            >
              {collapsed ? (
                <PanelLeftOpen aria-hidden className="h-4 w-4" />
              ) : (
                <PanelLeftClose aria-hidden className="h-4 w-4" />
              )}
            </button>
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
          </div>

          <button
            type="button"
            onClick={() => void refresh()}
            className="flex h-8 shrink-0 items-center gap-2 rounded-lg border border-hairline bg-raised px-3 text-[13px] hover:border-hairline-strong"
          >
            <RefreshSpinner refreshing={refreshing} />
            Refresh
            <kbd className="text-[11px] text-ink-muted">{shortcutLabel("Mod+R")}</kbd>
          </button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

/**
 * A scan usually finishes in milliseconds, far too fast for a spinner that
 * stops the moment it ends. So every scan, manual or automatic, turns the
 * icon at least once, and it only stops at the end of a full turn.
 */
function RefreshSpinner({ refreshing }: { refreshing: boolean }) {
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    if (refreshing) setSpinning(true);
  }, [refreshing]);

  return (
    <RefreshCw
      aria-hidden
      className={cn("h-3.5 w-3.5", spinning && "animate-spin")}
      onAnimationIteration={() => {
        if (!useData.getState().refreshing) setSpinning(false);
      }}
    />
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
