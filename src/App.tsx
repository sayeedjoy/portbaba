import { useCallback, useEffect, useRef } from "react";

import { AppShell } from "@/components/AppShell";
import { CommandPalette } from "@/components/CommandPalette";
import { KillDialog } from "@/components/KillDialog";
import { ProcessDetails } from "@/components/ProcessDetails";
import type { QuickKillHandle } from "@/components/QuickKill";
import type { SearchHandle } from "@/components/SearchBar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useHotkeys } from "@/hooks/useHotkeys";
import { usePortSync } from "@/hooks/usePorts";
import { Dashboard } from "@/pages/Dashboard";
import { Favorites } from "@/pages/Favorites";
import { History } from "@/pages/History";
import { Ports } from "@/pages/Ports";
import { Processes } from "@/pages/Processes";
import { Settings } from "@/pages/Settings";
import { useSettings } from "@/stores/settingsStore";
import { useUi } from "@/stores/uiStore";

export default function App() {
  const route = useUi((s) => s.route);
  const navigate = useUi((s) => s.navigate);
  const loadSettings = useSettings((s) => s.load);
  const loaded = useSettings((s) => s.loaded);

  const quickKillRef = useRef<QuickKillHandle>(null);
  const searchRef = useRef<SearchHandle>(null);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  usePortSync();

  // The shortcut may fire while another page is showing, so navigate first and
  // focus once the target has actually mounted.
  const focusQuickKill = useCallback(() => {
    navigate("dashboard");
    window.setTimeout(() => quickKillRef.current?.focus(), 0);
  }, [navigate]);

  const focusSearch = useCallback(() => {
    navigate("ports");
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }, [navigate]);

  useHotkeys({ focusQuickKill, focusSearch });

  if (!loaded) {
    // A brief, honest placeholder rather than a skeleton that pretends to have data.
    return (
      <div className="flex h-full items-center justify-center text-ink-muted">
        Starting Port Killer…
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={400}>
      <AppShell>
        {route === "dashboard" && <Dashboard ref={quickKillRef} />}
        {route === "ports" && <Ports ref={searchRef} />}
        {route === "processes" && <Processes />}
        {route === "favorites" && <Favorites />}
        {route === "history" && <History />}
        {route === "settings" && <Settings />}
      </AppShell>

      <CommandPalette />
      <KillDialog />
      <ProcessDetails />
      <Toaster position="bottom-right" richColors closeButton />
    </TooltipProvider>
  );
}
