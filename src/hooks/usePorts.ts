import { useEffect, useMemo } from "react";

import { useData } from "@/stores/dataStore";
import { useSettings } from "@/stores/settingsStore";
import * as api from "@/services/tauri";
import type { PortInfo } from "@/types/system";

/**
 * Keeps the port table current: an initial scan, an optional interval
 * (FR-010) and an immediate re-scan whenever Rust says something changed.
 */
export function usePortSync() {
  const refresh = useData((s) => s.refresh);
  const reloadHistory = useData((s) => s.reloadHistory);
  const loadLocalState = useData((s) => s.loadLocalState);
  const { autoRefresh, refreshInterval, showUdp, showEstablished } = useSettings(
    (s) => s.settings,
  );
  const loaded = useSettings((s) => s.loaded);

  // Re-scan when the scan options themselves change.
  useEffect(() => {
    if (!loaded) return;
    void refresh();
    void loadLocalState();
  }, [loaded, showUdp, showEstablished, refresh, loadLocalState]);

  useEffect(() => {
    if (!loaded || !autoRefresh) return;
    const id = window.setInterval(() => void refresh(), refreshInterval * 1000);
    return () => window.clearInterval(id);
  }, [loaded, autoRefresh, refreshInterval, refresh]);

  useEffect(() => {
    const unlisten = api.onPortsChanged(() => {
      void refresh();
      void reloadHistory();
    });
    return () => {
      void unlisten.then((off) => off());
    };
  }, [refresh, reloadHistory]);
}

/** FR-002 / FR-003 — one search box that understands ports and process names. */
export function useFilteredPorts(query: string): PortInfo[] {
  const ports = useData((s) => s.ports);

  return useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return ports;

    return ports.filter((port) => {
      if (String(port.port).startsWith(needle)) return true;
      if (String(port.pid) === needle) return true;
      if (port.processName.toLowerCase().includes(needle)) return true;
      if (port.address.toLowerCase().includes(needle)) return true;
      if (port.project?.name.toLowerCase().includes(needle)) return true;
      if (port.project?.framework?.toLowerCase().includes(needle)) return true;
      if (port.command?.toLowerCase().includes(needle)) return true;
      return false;
    });
  }, [ports, query]);
}
