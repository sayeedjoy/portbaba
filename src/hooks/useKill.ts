import { useCallback } from "react";

import * as api from "@/services/tauri";
import { useData } from "@/stores/dataStore";
import { useSettings } from "@/stores/settingsStore";
import { useUi, type KillRequest } from "@/stores/uiStore";
import { pluralise } from "@/lib/utils";
import type { KillResult, PortInfo } from "@/types/system";

/**
 * The single entry point for termination in the UI.
 *
 * FR-007: unless the user has switched confirmation off, nothing is terminated
 * without a dialog. The dialog itself is dumb — it just calls `execute`.
 */
export function useKill() {
  const confirmBeforeKill = useSettings((s) => s.settings.confirmBeforeKill);
  const allowForceKill = useSettings((s) => s.settings.allowForceKill);
  const requestKill = useUi((s) => s.requestKill);
  const dismissKill = useUi((s) => s.dismissKill);
  const reportResults = useUi((s) => s.reportResults);
  const toast = useUi((s) => s.toast);
  const refresh = useData((s) => s.refresh);
  const reloadHistory = useData((s) => s.reloadHistory);
  const ports = useData((s) => s.ports);

  const execute = useCallback(
    async (request: KillRequest) => {
      dismissKill();
      try {
        let results: KillResult[];
        switch (request.kind) {
          case "port":
            results = await api.killPort(request.port!, request.force);
            break;
          case "process":
            results = [
              request.force
                ? await api.forceKillProcess(request.pid!)
                : await api.killProcess(request.pid!),
            ];
            break;
          case "selection":
            results = await api.killProcesses(request.pids!, request.force);
            break;
          case "name":
            results = await api.killProcessesByName(request.name!, request.force);
            break;
        }
        reportResults(results);
      } catch (error) {
        toast("danger", error instanceof Error ? error.message : String(error));
      } finally {
        await refresh();
        await reloadHistory();
      }
    },
    [dismissKill, reportResults, toast, refresh, reloadHistory],
  );

  const start = useCallback(
    (request: KillRequest) => {
      if (request.force && !allowForceKill) {
        toast("danger", "Force kill is turned off in Settings → Safety.");
        return;
      }
      // A protected process always asks, whatever the confirmation setting is
      // (FR-008): that warning is the whole point of the guard.
      const needsConfirmation =
        confirmBeforeKill || request.targets.some((t) => t.protected);
      if (needsConfirmation) requestKill(request);
      else void execute(request);
    },
    [allowForceKill, confirmBeforeKill, execute, requestKill, toast],
  );

  const killPort = useCallback(
    (port: number, force = false) => {
      const targets = ports.filter((p) => p.port === port);
      start({
        kind: "port",
        title: `Port ${port}`,
        port,
        targets,
        force,
      });
    },
    [ports, start],
  );

  const killProcess = useCallback(
    (target: PortInfo, force = false) => {
      start({
        kind: "process",
        title: target.processName,
        pid: target.pid,
        port: target.port,
        processName: target.processName,
        targets: [target],
        force,
      });
    },
    [start],
  );

  const killSelection = useCallback(
    (selected: PortInfo[], force = false) => {
      const pids = [...new Set(selected.map((p) => p.pid))];
      start({
        kind: "selection",
        title: pluralise(pids.length, "process", "processes"),
        pids,
        targets: selected,
        force,
      });
    },
    [start],
  );

  const killByName = useCallback(
    (name: string, targets: PortInfo[], force = false) => {
      start({
        kind: "name",
        title: `Every ${name} process holding a port`,
        name,
        targets,
        force,
      });
    },
    [start],
  );

  return { killPort, killProcess, killSelection, killByName, execute };
}
