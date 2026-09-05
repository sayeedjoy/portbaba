import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { useKill } from "@/hooks/useKill";
import { cn, parsePort } from "@/lib/utils";
import * as api from "@/services/tauri";
import { useData } from "@/stores/dataStore";
import { useSettings } from "@/stores/settingsStore";
import { useUi } from "@/stores/uiStore";
import type { PortStatus } from "@/types/system";

export interface QuickKillHandle {
  focus: () => void;
}

/**
 * FR-011 / FR-014 / §52 — the whole point of the app in one control.
 *
 * The field checks the port while you type, so the answer to "is 3000 busy, and
 * what has it?" arrives before you decide to act. Type, read, press Enter:
 * three interactions, as §52 asks for.
 */
export const QuickKill = forwardRef<QuickKillHandle>(function QuickKill(_props, ref) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<PortStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const allowForceKill = useSettings((s) => s.settings.allowForceKill);
  const favorites = useData((s) => s.favorites);
  const setFavorites = useData((s) => s.setFavorites);
  const toast = useUi((s) => s.toast);
  const { killPort } = useKill();

  useImperativeHandle(ref, () => ({
    focus() {
      inputRef.current?.focus();
      inputRef.current?.select();
    },
  }));

  const port = parsePort(value);
  const tooLong = value.trim().length > 0 && port === null;

  // Live check, debounced so a fast typist does not trigger five scans.
  useEffect(() => {
    if (port === null) {
      setStatus(null);
      setChecking(false);
      return;
    }
    let cancelled = false;
    setChecking(true);

    const timer = window.setTimeout(() => {
      api
        .checkPort(port)
        .then((result) => {
          if (!cancelled) setStatus(result);
        })
        .catch(() => {
          if (!cancelled) setStatus(null);
        })
        .finally(() => {
          if (!cancelled) setChecking(false);
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [port]);

  const holder = status?.entries[0];
  const occupied = status ? !status.available : false;
  const isFavorite = port !== null && favorites.some((f) => f.port === port);

  function submit(force = false) {
    if (port === null) return;
    if (status?.available) {
      toast("info", `Port ${port} is already available.`);
      return;
    }
    killPort(port, force);
  }

  async function toggleFavorite() {
    if (port === null) return;
    try {
      const existing = favorites.find((f) => f.port === port);
      const next = existing
        ? await api.removeFavorite(existing.id)
        : await api.addFavorite(port, holder?.processName ?? `Port ${port}`, "");
      setFavorites(next);
    } catch (error) {
      toast("danger", error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <section
      className={cn(
        "rounded-2xl border bg-panel p-6 shadow-[var(--shadow-panel)] transition-colors duration-200",
        occupied ? "border-[var(--occupied)]" : "border-hairline",
      )}
      aria-labelledby="quick-kill-heading"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0 flex-1">
          <h2 id="quick-kill-heading" className="text-ink-soft">
            Free a port
          </h2>

          {/* The number is the hero: everything else on this screen stays quiet. */}
          <div className="mt-1 flex items-baseline gap-4">
            <input
              ref={inputRef}
              value={value}
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              aria-label="Port number"
              aria-describedby="quick-kill-status"
              placeholder="3000"
              maxLength={5}
              onChange={(event) =>
                setValue(event.target.value.replace(/[^\d]/g, "").slice(0, 5))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit(event.shiftKey && allowForceKill);
                }
              }}
              className={cn(
                "w-[5.2ch] bg-transparent p-0 text-[68px] leading-[1.05] font-bold tracking-[-0.035em]",
                "outline-none placeholder:text-ink-muted/35 focus-visible:outline-none",
                occupied && "text-[var(--occupied)]",
              )}
            />

            {port !== null && (
              <button
                type="button"
                onClick={() => void toggleFavorite()}
                aria-pressed={isFavorite}
                aria-label={isFavorite ? "Remove from favourites" : "Save to favourites"}
                className="rounded-md p-1.5 text-ink-muted hover:bg-raised hover:text-ink"
              >
                <Star
                  aria-hidden
                  className={cn("h-4 w-4", isFavorite && "fill-current text-ink")}
                />
              </button>
            )}
          </div>

          <p
            id="quick-kill-status"
            aria-live="polite"
            className="mt-2 min-h-[22px] text-[15px]"
          >
            <StatusLine
              value={value}
              tooLong={tooLong}
              port={port}
              checking={checking}
              status={status}
            />
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          {occupied && allowForceKill && (
            <Button size="lg" variant="quiet" onClick={() => submit(true)}>
              Force kill
            </Button>
          )}
          <Button
            size="lg"
            variant="danger"
            disabled={port === null || !occupied}
            onClick={() => submit(false)}
          >
            Kill port
          </Button>
        </div>
      </div>
    </section>
  );
});

function StatusLine({
  value,
  tooLong,
  port,
  checking,
  status,
}: {
  value: string;
  tooLong: boolean;
  port: number | null;
  checking: boolean;
  status: PortStatus | null;
}) {
  if (tooLong) {
    return <span className="text-[var(--danger)]">Ports run from 1 to 65535.</span>;
  }
  if (!value) {
    return <span className="text-ink-muted">Type a port to see what is holding it.</span>;
  }
  if (checking && !status) {
    return <span className="text-ink-muted">Checking…</span>;
  }
  if (!status || status.port !== port) {
    return <span className="text-ink-muted">Checking…</span>;
  }
  if (status.available) {
    return <span className="text-[var(--free)]">Nothing is using this port.</span>;
  }

  const holder = status.entries[0];
  const extra = status.entries.length - 1;

  return (
    <span className="text-ink">
      Held by{" "}
      <span className="font-semibold">{holder.processName}</span>
      {!holder.ownerUnknown && (
        <span className="text-ink-muted"> at PID {holder.pid}</span>
      )}
      {holder.project?.framework && (
        <span className="text-ink-soft"> — {holder.project.framework}</span>
      )}
      {holder.project && holder.project.framework !== holder.project.name && (
        <span className="text-ink-soft"> in {holder.project.name}</span>
      )}
      {extra > 0 && (
        <span className="text-ink-muted">
          {" "}
          and {extra} other {extra === 1 ? "process" : "processes"}
        </span>
      )}
    </span>
  );
}
