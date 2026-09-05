import { FolderOpen, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ProtectedTag } from "@/components/ui/StateTag";
import { useKill } from "@/hooks/useKill";
import { useProcessDetails } from "@/hooks/useProcesses";
import { formatBytes, relativeTime } from "@/lib/utils";
import * as api from "@/services/tauri";
import { useData } from "@/stores/dataStore";
import { useSettings } from "@/stores/settingsStore";
import { useUi } from "@/stores/uiStore";
import type { ReactNode } from "react";

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
    <Dialog open onClose={close} labelledBy="details-title" className="max-w-xl">
      <header className="flex items-start justify-between gap-4 border-b border-hairline px-6 py-5">
        <div className="min-w-0">
          <h2
            id="details-title"
            className="truncate text-[19px] font-semibold tracking-[-0.01em]"
          >
            {loading ? "Loading…" : (process?.name ?? `PID ${pid}`)}
          </h2>
          {process?.project?.framework && (
            <p className="mt-0.5 text-ink-soft">
              {process.project.framework}
              {process.project.name !== process.project.framework &&
                ` in ${process.project.name}`}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {process?.protected && <ProtectedTag />}
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="rounded-md p-1.5 text-ink-muted hover:bg-raised hover:text-ink"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>
      </header>

      {error ? (
        <div className="px-6 py-8">
          <p className="text-ink">{error}</p>
          <p className="mt-1 text-[13px] text-ink-muted">
            The port it held is free now. Refresh to update the table.
          </p>
        </div>
      ) : !process ? (
        <div className="px-6 py-8 text-ink-muted">Reading process information…</div>
      ) : (
        <>
          <dl className="divide-y divide-[var(--hairline)] px-6">
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

          <footer className="flex items-center justify-between gap-3 border-t border-hairline px-6 py-4">
            {process.project ? (
              <Button
                size="sm"
                onClick={() => {
                  api
                    .revealDirectory(process.project!.directory)
                    .catch((e: unknown) =>
                      toast("danger", e instanceof Error ? e.message : String(e)),
                    );
                }}
              >
                <FolderOpen aria-hidden className="h-3.5 w-3.5" />
                Open folder
              </Button>
            ) : (
              <span />
            )}

            <div className="flex gap-2">
              {allowForceKill && socket && (
                <Button
                  size="sm"
                  variant="quiet"
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
                  variant="danger"
                  onClick={() => {
                    close();
                    killProcess(socket);
                  }}
                >
                  Terminate
                </Button>
              )}
            </div>
          </footer>
        </>
      )}
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
