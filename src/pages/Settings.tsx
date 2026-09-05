import type { ReactNode } from "react";

import { PageHeader, Panel } from "@/components/AppShell";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { shortcutLabel } from "@/lib/utils";
import { useSettings } from "@/stores/settingsStore";
import type { ThemeChoice } from "@/types/system";

/** §38 — every switch the SRS asks for, grouped the way it groups them. */
export function Settings() {
  const settings = useSettings((s) => s.settings);
  const system = useSettings((s) => s.system);
  const update = useSettings((s) => s.update);

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <PageHeader title="Settings" />

      <Group title="General">
        <Row
          id="launch-at-startup"
          label="Launch at startup"
          hint="Open portbaba when you log in."
        >
          <Switch
            id="launch-at-startup"
            checked={settings.launchAtStartup}
            onCheckedChange={(launchAtStartup) => void update({ launchAtStartup })}
          />
        </Row>
        <Row
          id="close-to-tray"
          label="Keep running in the tray"
          hint="Closing the window leaves portbaba in the tray instead of quitting."
        >
          <Switch
            id="close-to-tray"
            checked={settings.closeToTray}
            onCheckedChange={(closeToTray) => void update({ closeToTray })}
          />
        </Row>
        <Row
          id="start-minimized"
          label="Start minimised"
          hint="Launch straight to the tray without opening the window."
        >
          <Switch
            id="start-minimized"
            checked={settings.startMinimized}
            onCheckedChange={(startMinimized) => void update({ startMinimized })}
          />
        </Row>
      </Group>

      <Group title="Port scanner">
        <Row
          id="auto-refresh"
          label="Refresh automatically"
          hint="Re-scan on an interval so the table stays current."
        >
          <Switch
            id="auto-refresh"
            checked={settings.autoRefresh}
            onCheckedChange={(autoRefresh) => void update({ autoRefresh })}
          />
        </Row>
        <Row
          id="refresh-interval"
          label="Refresh interval"
          hint="How often to re-read the socket table."
        >
          <Select
            value={String(settings.refreshInterval)}
            disabled={!settings.autoRefresh}
            onValueChange={(value) => void update({ refreshInterval: Number(value) })}
          >
            <SelectTrigger id="refresh-interval" className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 second</SelectItem>
              <SelectItem value="2">2 seconds</SelectItem>
              <SelectItem value="5">5 seconds</SelectItem>
              <SelectItem value="10">10 seconds</SelectItem>
              <SelectItem value="30">30 seconds</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <Row id="show-udp" label="Show UDP" hint="Include UDP sockets alongside TCP.">
          <Switch
            id="show-udp"
            checked={settings.showUdp}
            onCheckedChange={(showUdp) => void update({ showUdp })}
          />
        </Row>
        <Row
          id="show-established"
          label="Show established connections"
          hint="Include outbound and accepted connections, not just listening sockets."
        >
          <Switch
            id="show-established"
            checked={settings.showEstablished}
            onCheckedChange={(showEstablished) => void update({ showEstablished })}
          />
        </Row>
      </Group>

      <Group title="Safety">
        <Row
          id="confirm-before-kill"
          label="Confirm before terminating"
          hint="Ask first, so a stray click cannot stop a running server."
        >
          <Switch
            id="confirm-before-kill"
            checked={settings.confirmBeforeKill}
            onCheckedChange={(confirmBeforeKill) => void update({ confirmBeforeKill })}
          />
        </Row>
        <Row
          id="allow-force-kill"
          label="Allow force kill"
          hint="Offer the immediate stop that skips a clean shutdown."
        >
          <Switch
            id="allow-force-kill"
            checked={settings.allowForceKill}
            onCheckedChange={(allowForceKill) => void update({ allowForceKill })}
          />
        </Row>
        <Row
          id="protect-system"
          label="Protect system processes"
          hint="Refuse to terminate processes the operating system depends on."
        >
          <Switch
            id="protect-system"
            checked={settings.protectSystemProcesses}
            onCheckedChange={(protectSystemProcesses) =>
              void update({ protectSystemProcesses })
            }
          />
        </Row>
      </Group>

      <Group title="Notifications and shortcuts">
        <Row
          id="notifications"
          label="Show desktop notifications"
          hint="Report the result of a kill even when the window is hidden."
        >
          <Switch
            id="notifications"
            checked={settings.notifications}
            onCheckedChange={(notifications) => void update({ notifications })}
          />
        </Row>
        <Row
          id="global-shortcut"
          label="Global Quick Kill shortcut"
          hint={`Press ${shortcutLabel("Mod+Shift+K")} from any application to open Quick Kill.`}
        >
          <Switch
            id="global-shortcut"
            checked={settings.globalShortcutEnabled}
            onCheckedChange={(globalShortcutEnabled) =>
              void update({ globalShortcutEnabled })
            }
          />
        </Row>
      </Group>

      <Group title="Appearance">
        <Row id="theme" label="Theme">
          <Select
            value={settings.theme}
            onValueChange={(theme) => void update({ theme: theme as ThemeChoice })}
          >
            <SelectTrigger id="theme" className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">Match system</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </Row>
      </Group>

      {system && (
        <p className="mt-8 text-[13px] text-ink-muted">
          portbaba {system.appVersion} on {system.osVersion ?? system.os} (
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
        <div className="divide-y">{children}</div>
      </Panel>
    </section>
  );
}

/** One setting: the label is tied to its control, so the whole row is clickable. */
function Row({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-3.5">
      <div className="min-w-0">
        <Label htmlFor={id} className="cursor-pointer">
          {label}
        </Label>
        {hint && <p className="mt-0.5 text-[13px] text-ink-muted">{hint}</p>}
      </div>
      <div className="mt-0.5 shrink-0">{children}</div>
    </div>
  );
}
