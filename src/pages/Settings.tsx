import { PageHeader, Panel } from "@/components/AppShell";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { shortcutLabel } from "@/lib/utils";
import { useSettings } from "@/stores/settingsStore";
import type { ReactNode } from "react";

/** §38 — every switch the SRS asks for, grouped the way it groups them. */
export function Settings() {
  const settings = useSettings((s) => s.settings);
  const system = useSettings((s) => s.system);
  const update = useSettings((s) => s.update);

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <PageHeader title="Settings" />

      <Group title="General">
        <Toggle
          label="Launch at startup"
          hint="Open Port Killer when you log in."
          checked={settings.launchAtStartup}
          onChange={(launchAtStartup) => void update({ launchAtStartup })}
        />
        <Toggle
          label="Keep running in the tray"
          hint="Closing the window leaves Port Killer in the tray instead of quitting."
          checked={settings.closeToTray}
          onChange={(closeToTray) => void update({ closeToTray })}
        />
        <Toggle
          label="Start minimised"
          hint="Launch straight to the tray without opening the window."
          checked={settings.startMinimized}
          onChange={(startMinimized) => void update({ startMinimized })}
        />
      </Group>

      <Group title="Port scanner">
        <Toggle
          label="Refresh automatically"
          hint="Re-scan on an interval so the table stays current."
          checked={settings.autoRefresh}
          onChange={(autoRefresh) => void update({ autoRefresh })}
        />
        <Select
          label="Refresh interval"
          hint="How often to re-read the socket table."
          value={settings.refreshInterval}
          disabled={!settings.autoRefresh}
          onChange={(refreshInterval) => void update({ refreshInterval })}
          options={[
            { value: 1, label: "1 second" },
            { value: 2, label: "2 seconds" },
            { value: 5, label: "5 seconds" },
            { value: 10, label: "10 seconds" },
            { value: 30, label: "30 seconds" },
          ]}
        />
        <Toggle
          label="Show UDP"
          hint="Include UDP sockets alongside TCP."
          checked={settings.showUdp}
          onChange={(showUdp) => void update({ showUdp })}
        />
        <Toggle
          label="Show established connections"
          hint="Include outbound and accepted connections, not just listening sockets."
          checked={settings.showEstablished}
          onChange={(showEstablished) => void update({ showEstablished })}
        />
      </Group>

      <Group title="Safety">
        <Toggle
          label="Confirm before terminating"
          hint="Ask first, so a stray click cannot stop a running server."
          checked={settings.confirmBeforeKill}
          onChange={(confirmBeforeKill) => void update({ confirmBeforeKill })}
        />
        <Toggle
          label="Allow force kill"
          hint="Offer the immediate stop that skips a clean shutdown."
          checked={settings.allowForceKill}
          onChange={(allowForceKill) => void update({ allowForceKill })}
        />
        <Toggle
          label="Protect system processes"
          hint="Refuse to terminate processes the operating system depends on."
          checked={settings.protectSystemProcesses}
          onChange={(protectSystemProcesses) => void update({ protectSystemProcesses })}
        />
      </Group>

      <Group title="Notifications and shortcuts">
        <Toggle
          label="Show desktop notifications"
          hint="Report the result of a kill even when the window is hidden."
          checked={settings.notifications}
          onChange={(notifications) => void update({ notifications })}
        />
        <Toggle
          label="Global Quick Kill shortcut"
          hint={`Press ${shortcutLabel("Mod+Shift+K")} from any application to open Quick Kill.`}
          checked={settings.globalShortcutEnabled}
          onChange={(globalShortcutEnabled) => void update({ globalShortcutEnabled })}
        />
      </Group>

      <Group title="Appearance">
        <Select
          label="Theme"
          value={settings.theme}
          onChange={(theme) => void update({ theme })}
          options={[
            { value: "system", label: "Match system" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
        />
      </Group>

      {system && (
        <p className="mt-8 text-[13px] text-ink-muted">
          Port Killer {system.appVersion} on {system.osVersion ?? system.os} (
          {system.arch}).{" "}
          {system.elevated
            ? "Running with elevated privileges."
            : "Running as a normal user, so processes owned by others cannot be terminated."}
        </p>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="mb-2 font-medium">{title}</h2>
      <Panel className="px-5 py-1">
        <div className="divide-y divide-[var(--hairline)]">{children}</div>
      </Panel>
    </section>
  );
}
