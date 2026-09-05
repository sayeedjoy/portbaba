import { useEffect } from "react";

import { useData } from "@/stores/dataStore";
import { useUi } from "@/stores/uiStore";
import * as api from "@/services/tauri";

/** §55 — the app-wide keyboard shortcuts. */
export function useHotkeys(options: { focusQuickKill: () => void; focusSearch: () => void }) {
  const setPaletteOpen = useUi((s) => s.setPaletteOpen);
  const navigate = useUi((s) => s.navigate);
  const refresh = useData((s) => s.refresh);
  const { focusQuickKill, focusSearch } = options;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      const key = event.key.toLowerCase();

      if (key === "k" && event.shiftKey) {
        event.preventDefault();
        navigate("dashboard");
        focusQuickKill();
        return;
      }
      if (key === "k") {
        event.preventDefault();
        setPaletteOpen(!useUi.getState().paletteOpen);
        return;
      }
      if (key === "r") {
        event.preventDefault();
        void refresh();
        return;
      }
      if (key === "f") {
        event.preventDefault();
        navigate("ports");
        focusSearch();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusQuickKill, focusSearch, navigate, refresh, setPaletteOpen]);

  // FR-024 / FR-025 — the tray item and the global shortcut both land here.
  useEffect(() => {
    const listeners = [
      api.onTrayQuickKill(() => {
        navigate("dashboard");
        focusQuickKill();
      }),
      api.onGlobalQuickKill(() => {
        navigate("dashboard");
        focusQuickKill();
      }),
      api.onShortcutError((message) => useUi.getState().toast("danger", message)),
      api.onSettingsError((message) => useUi.getState().toast("danger", message)),
    ];
    return () => {
      listeners.forEach((p) => void p.then((off) => off()));
    };
  }, [focusQuickKill, navigate]);
}
