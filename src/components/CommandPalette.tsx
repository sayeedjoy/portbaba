import { useEffect, useMemo, useRef, useState } from "react";

import { Dialog } from "@/components/ui/Dialog";
import { useKill } from "@/hooks/useKill";
import { cn, parsePort, parseRange } from "@/lib/utils";
import { useData } from "@/stores/dataStore";
import { useSettings } from "@/stores/settingsStore";
import { useUi, type Route } from "@/stores/uiStore";

interface Command {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

/** §31 / FR-026 — Ctrl/Cmd+K. Typing a number turns it into a port command. */
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
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [];
    const port = parsePort(query);
    const range = parseRange(query);

    // A bare number is almost always "deal with this port".
    if (port !== null) {
      const holder = ports.find((p) => p.port === port);
      list.push({
        id: `kill-${port}`,
        label: `Kill port ${port}`,
        hint: holder ? `held by ${holder.processName}` : "nothing is using it",
        run: () => killPort(port),
      });
      list.push({
        id: `check-${port}`,
        label: `Check port ${port}`,
        hint: "open it in Quick Kill",
        run: () => {
          navigate("dashboard");
          window.setTimeout(() => {
            const input = document.querySelector<HTMLInputElement>(
              "input[aria-label='Port number']",
            );
            if (input) {
              const setter = Object.getOwnPropertyDescriptor(
                HTMLInputElement.prototype,
                "value",
              )?.set;
              setter?.call(input, String(port));
              input.dispatchEvent(new Event("input", { bubbles: true }));
              input.focus();
            }
          }, 0);
        },
      });
    }

    if (range) {
      list.push({
        id: "range",
        label: `Scan ports ${range[0]}–${range[1]}`,
        hint: "open the range scanner",
        run: () => {
          navigate("ports");
          toast("info", `Type ${range[0]}-${range[1]} in the Ports search to scan it.`);
        },
      });
    }

    // FR-020 — "Show Node processes" / "Kill all node".
    const names = [...new Set(groups.map((g) => g.name))];
    for (const name of names) {
      list.push({
        id: `show-${name}`,
        label: `Show ${name} processes`,
        run: () => navigate("processes"),
      });
      const targets = ports.filter((p) => p.processName === name);
      list.push({
        id: `kill-all-${name}`,
        label: `Kill every ${name} process`,
        hint: `${targets.length} holding a port`,
        run: () => killByName(name, targets),
      });
    }

    // One entry per process-and-port: a server listening on both IPv4 and IPv6
    // is two sockets but only one thing the user can act on.
    const seen = new Set<string>();
    for (const port of ports) {
      const key = `${port.pid}:${port.port}`;
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({
        id: `details-${key}`,
        label: `${port.processName} on port ${port.port}`,
        hint: `PID ${port.pid}`,
        run: () => openDetails(port.pid),
      });
      if (seen.size >= 40) break;
    }

    const routes: [Route, string][] = [
      ["dashboard", "Open Dashboard"],
      ["ports", "Open Ports"],
      ["processes", "Open Processes"],
      ["favorites", "Open Favourites"],
      ["history", "Open History"],
      ["settings", "Open Settings"],
    ];
    for (const [route, label] of routes) {
      list.push({ id: `go-${route}`, label, run: () => navigate(route) });
    }

    list.push({
      id: "refresh",
      label: "Refresh ports",
      run: () => void refresh(),
    });
    list.push({
      id: "theme",
      label: theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
      run: () => void updateSettings({ theme: theme === "dark" ? "light" : "dark" }),
    });

    return list;
  }, [
    query,
    ports,
    groups,
    theme,
    killPort,
    killByName,
    navigate,
    openDetails,
    refresh,
    toast,
    updateSettings,
  ]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands.slice(0, 12);
    // The port commands built above already carry the number in their label, so
    // a plain substring match keeps them at the top without letting a numeric
    // query match everything else too.
    return commands
      .filter(
        (c) =>
          c.label.toLowerCase().includes(needle) ||
          c.hint?.toLowerCase().includes(needle),
      )
      .slice(0, 12);
  }, [commands, query]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  function run(command: Command) {
    setOpen(false);
    command.run();
  }

  return (
    <Dialog open onClose={() => setOpen(false)} className="max-w-xl">
      <div className="border-b border-hairline px-4">
        <input
          data-autofocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((i) => Math.min(i + 1, results.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (event.key === "Enter" && results[active]) {
              event.preventDefault();
              run(results[active]);
            }
          }}
          placeholder="Type a port number or a command"
          aria-label="Command palette"
          spellCheck={false}
          autoComplete="off"
          className="h-14 w-full bg-transparent text-[16px] outline-none placeholder:text-ink-muted"
        />
      </div>

      {results.length === 0 ? (
        <p className="px-4 py-8 text-center text-ink-muted">
          No command matches “{query}”.
        </p>
      ) : (
        <ul ref={listRef} className="max-h-[46vh] overflow-y-auto p-1.5">
          {results.map((command, index) => (
            <li key={command.id}>
              <button
                type="button"
                data-index={index}
                onMouseEnter={() => setActive(index)}
                onClick={() => run(command)}
                className={cn(
                  "flex w-full items-baseline gap-3 rounded-lg px-2.5 py-2 text-left",
                  index === active && "bg-raised",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{command.label}</span>
                {command.hint && (
                  <span className="shrink-0 text-[12.5px] text-ink-muted">
                    {command.hint}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
