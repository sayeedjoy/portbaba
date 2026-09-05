import { useEffect, useMemo, useState } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useKill } from "@/hooks/useKill";
import { parsePort, parseRange } from "@/lib/utils";
import { useData } from "@/stores/dataStore";
import { useSettings } from "@/stores/settingsStore";
import { useUi, type Route } from "@/stores/uiStore";

/**
 * §31 / FR-026 — Ctrl/Cmd+K.
 *
 * cmdk handles filtering, keyboard navigation and the listbox semantics; what
 * this adds is the port-aware commands, which only exist once the query parses
 * as a port or a range.
 */
export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen);
  const setOpen = useUi((s) => s.setPaletteOpen);
  const navigate = useUi((s) => s.navigate);
  const openDetails = useUi((s) => s.openDetails);
  const toast = useUi((s) => s.toast);
  const refresh = useData((s) => s.refresh);
  const ports = useData((s) => s.ports);
  const groups = useData((s) => s.groups);
  const theme = useSettings((s) => s.settings.theme);
  const updateSettings = useSettings((s) => s.update);
  const { killPort, killByName } = useKill();

  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const port = parsePort(query);
  const range = parseRange(query);

  /** Every command dismisses the palette before it acts. */
  function run(action: () => void) {
    setOpen(false);
    action();
  }

  const names = useMemo(() => [...new Set(groups.map((g) => g.name))], [groups]);

  // One entry per process-and-port: a server listening on both IPv4 and IPv6 is
  // two sockets but only one thing the user can act on.
  const processEntries = useMemo(() => {
    const seen = new Set<string>();
    return ports.filter((p) => {
      const key = `${p.pid}:${p.port}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [ports]);

  const routes: [Route, string][] = [
    ["dashboard", "Open Dashboard"],
    ["ports", "Open Ports"],
    ["processes", "Open Processes"],
    ["favorites", "Open Favourites"],
    ["history", "Open History"],
    ["settings", "Open Settings"],
  ];

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Commands"
      description="Type a port number or a command"
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Type a port number or a command"
      />
      <CommandList>
        <CommandEmpty>No command matches “{query}”.</CommandEmpty>

        {/* A bare number is almost always "deal with this port". */}
        {port !== null && (
          <CommandGroup heading={`Port ${port}`}>
            <CommandItem
              value={`kill port ${port}`}
              onSelect={() => run(() => killPort(port))}
            >
              <span>Kill port {port}</span>
              <span className="ml-auto text-[12.5px] text-ink-muted">
                {ports.find((p) => p.port === port)
                  ? `held by ${ports.find((p) => p.port === port)!.processName}`
                  : "nothing is using it"}
              </span>
            </CommandItem>
            <CommandItem
              value={`check port ${port}`}
              onSelect={() =>
                run(() => {
                  navigate("dashboard");
                  window.setTimeout(() => {
                    document
                      .querySelector<HTMLInputElement>("input[aria-label='Port number']")
                      ?.focus();
                  }, 0);
                })
              }
            >
              <span>Check port {port}</span>
              <span className="ml-auto text-[12.5px] text-ink-muted">
                open it in Quick Kill
              </span>
            </CommandItem>
          </CommandGroup>
        )}

        {range && (
          <CommandGroup heading="Range">
            <CommandItem
              value={`scan ${range[0]} ${range[1]}`}
              onSelect={() =>
                run(() => {
                  navigate("ports");
                  toast(
                    "info",
                    `Type ${range[0]}-${range[1]} in the Ports search to scan it.`,
                  );
                })
              }
            >
              Scan ports {range[0]}–{range[1]}
            </CommandItem>
          </CommandGroup>
        )}

        {processEntries.length > 0 && (
          <CommandGroup heading="Processes">
            {processEntries.slice(0, 40).map((entry) => (
              <CommandItem
                key={`${entry.pid}:${entry.port}`}
                value={`${entry.processName} port ${entry.port} pid ${entry.pid}`}
                onSelect={() => run(() => openDetails(entry.pid))}
              >
                <span>
                  {entry.processName} on port {entry.port}
                </span>
                <span className="ml-auto text-[12.5px] text-ink-muted">
                  PID {entry.pid}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* FR-020 — "Kill all Node processes". */}
        {names.length > 0 && (
          <CommandGroup heading="Bulk">
            {names.map((name) => {
              const targets = ports.filter((p) => p.processName === name);
              return (
                <CommandItem
                  key={name}
                  value={`kill every ${name} process`}
                  onSelect={() => run(() => killByName(name, targets))}
                >
                  <span>Kill every {name} process</span>
                  <span className="ml-auto text-[12.5px] text-ink-muted">
                    {targets.length} holding a port
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        <CommandSeparator />

        <CommandGroup heading="Go to">
          {routes.map(([route, label]) => (
            <CommandItem
              key={route}
              value={label}
              onSelect={() => run(() => navigate(route))}
            >
              {label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Actions">
          <CommandItem value="refresh ports" onSelect={() => run(() => void refresh())}>
            Refresh ports
          </CommandItem>
          <CommandItem
            value="switch theme"
            onSelect={() =>
              run(() => void updateSettings({ theme: theme === "dark" ? "light" : "dark" }))
            }
          >
            {theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
