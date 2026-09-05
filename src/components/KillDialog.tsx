import { ShieldAlert, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useKill } from "@/hooks/useKill";
import { cn, pluralise } from "@/lib/utils";
import { useSettings } from "@/stores/settingsStore";
import { useUi } from "@/stores/uiStore";

/**
 * FR-007 — the confirmation step, and FR-008's warning when the target turns
 * out to be something the operating system needs.
 */
export function KillDialog() {
  const request = useUi((s) => s.killRequest);
  const dismiss = useUi((s) => s.dismissKill);
  const protectSystem = useSettings((s) => s.settings.protectSystemProcesses);
  const { execute } = useKill();

  if (!request) return null;

  const protectedTargets = request.targets.filter((t) => t.protected);
  const blocked = protectSystem && protectedTargets.length > 0;
  const ports = [...new Set(request.targets.map((t) => t.port))].sort((a, b) => a - b);
  const pids = [...new Set(request.targets.map((t) => t.pid))];

  return (
    <Dialog open onClose={dismiss} labelledBy="kill-dialog-title">
      <div className="p-6">
        <h2 id="kill-dialog-title" className="text-[19px] font-semibold tracking-[-0.01em]">
          {request.force ? "Force kill" : "Terminate"} {request.title.toLowerCase()}?
        </h2>

        {/* What exactly is about to happen. */}
        <div className="mt-4 overflow-hidden rounded-xl border border-hairline">
          {request.targets.length === 0 ? (
            <p className="px-4 py-3 text-ink-soft">
              Nothing is holding port {request.port} right now. Running this will simply
              confirm it is free.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--hairline)]">
              {request.targets.slice(0, 6).map((target) => (
                <li
                  key={target.id}
                  className={cn(
                    "flex items-baseline gap-3 px-4 py-2.5",
                    target.protected && "bg-[var(--protected-wash)]",
                  )}
                >
                  <span className="w-14 shrink-0 text-[15px] font-semibold">
                    {target.port}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{target.processName}</span>
                  <span className="shrink-0 text-[13px] text-ink-muted">
                    PID {target.pid}
                  </span>
                </li>
              ))}
              {request.targets.length > 6 && (
                <li className="px-4 py-2.5 text-[13px] text-ink-muted">
                  and {request.targets.length - 6} more
                </li>
              )}
            </ul>
          )}
        </div>

        {blocked ? (
          <Warning
            icon={ShieldAlert}
            tone="protected"
            title="This is a system process"
            body={`Terminating ${protectedTargets
              .map((t) => t.processName)
              .join(", ")} may cause system instability, so Port Killer will refuse. Turn off "Protect system processes" in Settings → Safety if you are certain.`}
          />
        ) : protectedTargets.length > 0 ? (
          <Warning
            icon={ShieldAlert}
            tone="protected"
            title="This is a system process"
            body="System-process protection is off, so this will go ahead. It may cause system instability."
          />
        ) : (
          <Warning
            icon={TriangleAlert}
            tone="neutral"
            title={
              request.force
                ? "This process will be stopped immediately"
                : "This process may have unsaved work"
            }
            body={
              request.force
                ? "Force kill does not give the process a chance to shut down, so anything it has not written to disk is lost."
                : "It will be asked to shut down cleanly. Anything it has not written to disk may still be lost."
            }
          />
        )}

        {/* A short, factual recap — plain text rather than decorative meta. */}
        {request.targets.length > 1 && (
          <p className="mt-3 text-[13px] text-ink-muted">
            {pluralise(pids.length, "process", "processes")} across{" "}
            {pluralise(ports.length, "port")}.
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button onClick={dismiss} variant="quiet">
            Cancel
          </Button>
          <Button
            data-autofocus
            variant="danger"
            disabled={blocked}
            onClick={() => void execute(request)}
          >
            {request.force ? "Force kill" : "Terminate"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function Warning({
  icon: Icon,
  title,
  body,
  tone,
}: {
  icon: typeof TriangleAlert;
  title: string;
  body: string;
  tone: "protected" | "neutral";
}) {
  return (
    <div
      className={cn(
        "mt-4 flex gap-3 rounded-xl p-3.5",
        tone === "protected" ? "bg-[var(--protected-wash)]" : "bg-raised",
      )}
    >
      <Icon
        aria-hidden
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          tone === "protected" ? "text-[var(--protected)]" : "text-ink-muted",
        )}
      />
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">{body}</p>
      </div>
    </div>
  );
}
