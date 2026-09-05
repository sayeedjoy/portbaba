import type { ReactNode } from "react";
import { FolderOpen } from "lucide-react";

import { ProtectedTag } from "@/components/app/StateTag";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useKill } from "@/hooks/useKill";
import { useProcessDetails } from "@/hooks/useProcesses";
import { formatBytes, relativeTime } from "@/lib/utils";
import * as api from "@/services/tauri";
import { useData } from "@/stores/dataStore";
import { useSettings } from "@/stores/settingsStore";
import { useUi } from "@/stores/uiStore";

/** FR-016, FR-017, FR-018 — everything we know about one process. */
export function ProcessDetails() {
  const pid = useUi((s) => s.detailsPid);
  const close = useUi((s) => s.closeDetails);
  const toast = useUi((s) => s.toast);
  const allowForceKill = useSettings((s) => s.settings.allowForceKill);
  const ports = useData((s) => s.ports);
  const { killProcess } = useKill();
  const { process, error, loading } = useProcessDetails(pid);

  if (pid === null) return null;

  const socket = ports.find((p) => p.pid === pid);

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-xl gap-0 p-0">
        <DialogHeader className="flex-row items-start justify-between gap-4 space-y-0 px-6 py-5">
          <div className="min-w-0">
            <DialogTitle className="truncate text-[19px]">
              {loading ? "Loading…" : (process?.name ?? `PID ${pid}`)}
            </DialogTitle>
            <DialogDescription className="mt-0.5">
              {process?.project?.framework
                ? `${process.project.framework}${
                    process.project.name !== process.project.framework
                      ? ` in ${process.project.name}`
                      : ""
                  }`
                : `Process details for PID ${pid}`}
            </DialogDescription>
          </div>
          {process?.protected && <ProtectedTag className="mt-1 mr-6 shrink-0" />}
        </DialogHeader>

        <Separator />

        {error ? (
          <div className="px-6 py-8">
            <p>{error}</p>
            <p className="mt-1 text-[13px] text-ink-muted">
              The port it held is free now. Refresh to update the table.
            </p>
          </div>
        ) : !process ? (
          <div className="px-6 py-8 text-ink-muted">Reading process information…</div>
        ) : (
          <>
            <dl className="divide-y px-6">
              <Field label="Process ID">{process.pid}</Field>

              {process.ports.length > 0 && (
                <Field label={process.ports.length === 1 ? "Port" : "Ports"}>
                  {process.ports.join(", ")}
                </Field>
              )}

              {process.user && <Field label="User">{process.user}</Field>}

              {process.runTime !== undefined && (
                <Field label="Started">{relativeTime(process.runTime)}</Field>
              )}

              <Field label="Memory">{formatBytes(process.memoryBytes)}</Field>

              {process.executable && (
                <Field label="Executable">
                  <span className="selectable font-mono text-[12.5px] break-all">
                    {process.executable}
                  </span>
                </Field>
              )}

              {/* FR-017 — the command that started it, verbatim. */}
              {process.command && (
                <Field label="Command">
                  <span className="selectable font-mono text-[12.5px] break-all">
                    {process.command}
                  </span>
                </Field>
              )}

              {/* FR-018 — where the project lives. */}
              {process.project && (
                <Field label="Project">
                  <span className="selectable font-mono text-[12.5px] break-all">
                    {process.project.directory}
                  </span>
                </Field>
              )}
            </dl>

            <Separator />

            <DialogFooter className="flex-row items-center justify-between px-6 py-4 sm:justify-between">
              {process.project ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    api
                      .revealDirectory(process.project!.directory)
                      .catch((e: unknown) =>
                        toast("danger", e instanceof Error ? e.message : String(e)),
                      );
                  }}
                >
                  <FolderOpen aria-hidden />
                  Open folder
                </Button>
              ) : (
                <span />
              )}

              <div className="flex gap-2">
                {allowForceKill && socket && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      close();
                      killProcess(socket, true);
                    }}
                  >
                    Force kill
                  </Button>
                )}
                {socket && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      close();
                      killProcess(socket);
                    }}
                  >
                    Terminate
                  </Button>
                )}
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[128px_1fr] items-baseline gap-4 py-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="selectable min-w-0">{children}</dd>
    </div>
  );
}
