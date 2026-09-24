import { useEffect, useState, type ReactNode } from "react";
import {
  Clock,
  Command,
  Gauge,
  Info,
  Moon,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
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
import { ROUTES, useUi, type Route } from "@/stores/uiStore";

const NAV: Record<Route, { label: string; icon: typeof Gauge }> = {
  dashboard: { label: "dashboard", icon: Gauge },
  ports: { label: "ports", icon: Network },
  processes: { label: "processes", icon: Terminal },
  favorites: { label: "favourites", icon: Star },
  history: { label: "history", icon: Clock },
  settings: { label: "settings", icon: SettingsIcon },
};

const navButton =
  "relative flex h-8 w-full items-center gap-2.5 rounded-sm text-left text-ink-soft hover:bg-raised hover:text-ink";

/**
 * §32 — the app's frame, laid out like an editor: sections down the side, the
 * page in the middle, and a status bar along the bottom that answers "is this
 * current?" without taking a line of the page for it.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const route = useUi((s) => s.route);
  const navigate = useUi((s) => s.navigate);
  const setPaletteOpen = useUi((s) => s.setPaletteOpen);
  const setAboutOpen = useUi((s) => s.setAboutOpen);
  const updateSettings = useSettings((s) => s.update);
  const version = useSettings((s) => s.system?.appVersion);
  const resolvedTheme = useResolvedTheme();
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const toggleSidebar = useUi((s) => s.toggleSidebar);

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1">
        <nav
          aria-label="Sections"
          className={cn(
            "flex shrink-0 flex-col overflow-hidden border-r border-hairline bg-panel transition-[width] duration-200",
            collapsed ? "w-[52px]" : "w-[196px]",
          )}
        >
          <div className={cn("flex h-14 items-center gap-2.5", collapsed ? "px-3" : "px-4")}>
            <img src={appIcon} alt="" className="size-7 shrink-0" draggable={false} />
            {!collapsed && (
              <div className="min-w-0 leading-tight">
                <p className="truncate font-mono font-semibold">portbaba</p>
                {version && (
                  <p className="truncate font-mono text-[11.5px] text-ink-muted">v{version}</p>
                )}
              </div>
            )}
          </div>

          <ul className="flex-1 px-2 pt-1">
            {ROUTES.map((target, index) => {
              const { label, icon: Icon } = NAV[target];
              const active = route === target;
              const keys = shortcutLabel(`Mod+${index + 1}`);
              return (
                <li key={target}>
                  <button
                    type="button"
                    onClick={() => navigate(target)}
                    aria-current={active ? "page" : undefined}
                    aria-label={collapsed ? label : undefined}
                    title={collapsed ? `${label} (${keys})` : undefined}
                    className={cn(
                      navButton,
                      "mb-px",
                      collapsed ? "justify-center" : "px-2.5",
                      active &&
                        "bg-raised font-medium text-ink shadow-[inset_2px_0_0_var(--ink)]",
                    )}
                  >
                    <Icon aria-hidden className="h-4 w-4 shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="truncate">{label}</span>
                        <kbd className="ml-auto font-mono text-[11px] font-normal text-ink-muted">
                          {keys}
                        </kbd>
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="border-t border-hairline p-2">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label={collapsed ? "Commands" : undefined}
              title={collapsed ? `Commands (${shortcutLabel("Mod+K")})` : undefined}
              className={cn(navButton, "mb-px", collapsed ? "justify-center" : "px-2.5")}
            >
              <Command aria-hidden className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <>
                  commands
                  <kbd className="ml-auto font-mono text-[11px] text-ink-muted">
                    {shortcutLabel("Mod+K")}
                  </kbd>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() =>
                void updateSettings({ theme: resolvedTheme === "dark" ? "light" : "dark" })
              }
              aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} theme`}
              title={collapsed ? (resolvedTheme === "dark" ? "Light theme" : "Dark theme") : undefined}
              className={cn(navButton, "mb-px", collapsed ? "justify-center" : "px-2.5")}
            >
              {resolvedTheme === "dark" ? (
                <Sun aria-hidden className="h-4 w-4 shrink-0" />
              ) : (
                <Moon aria-hidden className="h-4 w-4 shrink-0" />
              )}
              {!collapsed && (resolvedTheme === "dark" ? "light theme" : "dark theme")}
            </button>
            <button
              type="button"
              onClick={() => setAboutOpen(true)}
              aria-label={collapsed ? "About" : undefined}
              title={collapsed ? "About" : undefined}
              className={cn(navButton, "mb-px", collapsed ? "justify-center" : "px-2.5")}
            >
              <Info aria-hidden className="h-4 w-4 shrink-0" />
              {!collapsed && "about"}
            </button>
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              title={collapsed ? `Expand sidebar (${shortcutLabel("Mod+B")})` : undefined}
              className={cn(navButton, collapsed ? "justify-center" : "px-2.5")}
            >
              {collapsed ? (
                <PanelLeftOpen aria-hidden className="h-4 w-4 shrink-0" />
              ) : (
                <PanelLeftClose aria-hidden className="h-4 w-4 shrink-0" />
              )}
              {!collapsed && (
                <>
                  collapse
                  <kbd className="ml-auto font-mono text-[11px] text-ink-muted">
                    {shortcutLabel("Mod+B")}
                  </kbd>
                </>
              )}
            </button>
          </div>
        </nav>

        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>

      <StatusBar />
    </div>
  );
}

/**
 * The bottom strip. Every item is a live fact about the scan or a filter that
 * shapes it; the filters toggle in place so they can be flipped without
 * leaving the page.
 */
function StatusBar() {
  const refresh = useData((s) => s.refresh);
  const refreshing = useData((s) => s.refreshing);
  const lastScan = useData((s) => s.lastScan);
  const scanMs = useData((s) => s.scanMs);
  const error = useData((s) => s.error);
  const ports = useData((s) => s.ports);
  const settings = useSettings((s) => s.settings);
  const system = useSettings((s) => s.system);
  const update = useSettings((s) => s.update);

  const listening = new Set(
    ports.filter((p) => p.state === "LISTEN").map((p) => `${p.port}:${p.pid}`),
  ).size;

  const scan = error
    ? error
    : refreshing && !lastScan
      ? "scanning…"
      : lastScan
        ? `scanned ${new Date(lastScan).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          })}${scanMs !== null ? ` in ${scanMs}ms` : ""}`
        : "";

  return (
    <footer className="flex h-6 shrink-0 items-stretch border-t border-hairline bg-panel font-mono text-[11.5px] text-ink-soft">
      <StatusItem
        onClick={() => void refresh()}
        title={`Rescan (${shortcutLabel("Mod+R")})`}
        className={cn(error && "text-[var(--danger)]")}
      >
        <span
          aria-hidden
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            error ? "bg-[var(--danger)]" : "bg-[var(--free)]",
          )}
        />
        <RefreshSpinner refreshing={refreshing} />
        <span aria-live="polite" className="truncate">
          {scan}
        </span>
      </StatusItem>

      <StatusItem>
        <span className="text-ink">{listening}</span> listening
      </StatusItem>
      <StatusItem>
        <span className="text-ink">{ports.length}</span> sockets
      </StatusItem>

      <div className="ml-auto flex items-stretch">
        <StatusItem
          onClick={() => void update({ devOnly: !settings.devOnly })}
          title="Toggle Dev only"
          pressed={settings.devOnly}
        >
          {settings.devOnly ? "dev only" : "all sockets"}
        </StatusItem>
        <StatusItem
          onClick={() => void update({ showUdp: !settings.showUdp })}
          title="Toggle UDP"
          pressed={settings.showUdp}
        >
          {settings.showUdp ? "tcp+udp" : "tcp"}
        </StatusItem>
        <StatusItem title="Change in Settings → Port scanner">
          {settings.autoRefresh ? `auto ${settings.refreshInterval}s` : "auto off"}
        </StatusItem>
        {system && (
          <StatusItem
            title={
              system.elevated
                ? "Running with elevated privileges"
                : "Running as a normal user; processes owned by others cannot be terminated"
            }
            className={cn(system.elevated && "text-[var(--occupied)]")}
          >
            {system.elevated ? "elevated" : "user"}
          </StatusItem>
        )}
      </div>
    </footer>
  );
}

function StatusItem({
  children,
  onClick,
  title,
  pressed,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  title?: string;
  pressed?: boolean;
  className?: string;
}) {
  const base = cn("flex min-w-0 items-center gap-1.5 px-2.5 whitespace-nowrap", className);
  if (!onClick) {
    return (
      <span title={title} className={base}>
        {children}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={pressed}
      className={cn(base, "hover:bg-raised hover:text-ink")}
    >
      {children}
    </button>
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
      className={cn("h-3 w-3 shrink-0", spinning && "animate-spin")}
      onAnimationIteration={() => {
        if (!useData.getState().refreshing) setSpinning(false);
      }}
    />
  );
}

/**
 * A page heading plus its controls. Every page uses the same rhythm: the
 * section name, then a one-line summary set as a code comment.
 */
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
        <h1 className="text-[18px] leading-tight font-semibold tracking-[-0.01em]">{title}</h1>
        {description && (
          <p className="mt-1 font-mono text-[12.5px] text-ink-muted">
            <span aria-hidden>// </span>
            {description}
          </p>
        )}
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
      className={cn("overflow-hidden rounded-md border border-hairline bg-panel", className)}
    >
      {children}
    </section>
  );
}

/** Empty states point at the next action rather than describing the void. */
export function Empty({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mx-auto max-w-md">
      <p className="text-ink-soft">{title}</p>
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}
