import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
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
 *
 * It is drawn as a prompt: `:port`, a block cursor, and the answer printed on
 * the line below like command output.
 */
export const QuickKill = forwardRef<QuickKillHandle>(function QuickKill(_props, ref) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<PortStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [focused, setFocused] = useState(false);
  // Where the drawn cursor sits, in characters. The native caret is a hairline
  // at this size, so a thicker editor-style bar replaces it whenever the
  // selection is collapsed; with a range selected there is no caret to draw.
  const [caret, setCaret] = useState<number | null>(0);
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

  function trackCaret() {
    const el = inputRef.current;
    if (!el) return;
    setCaret(el.selectionStart === el.selectionEnd ? el.selectionStart : null);
  }

  // Typing, deleting and filtered keystrokes all move the caret; read it back
  // once React has written the new value.
  useLayoutEffect(trackCaret, [value]);

  // Chromium fires `selectionchange` on the input itself, which React's
  // document-level onSelect never hears, so listen where it actually lands.
  useEffect(() => {
    const el = inputRef.current;
    el?.addEventListener("selectionchange", trackCaret);
    return () => el?.removeEventListener("selectionchange", trackCaret);
  }, []);

  // Monospace, so one `ch` is exactly one digit: the cursor's offset is its
  // character index, and the field is as wide as its text (or the ghost "3000").
  const cells = Math.max(value.length, 4);
  const showCaret = focused && caret !== null;

  return (
    <section
      className={cn(
        "rounded-md border bg-panel transition-colors duration-200",
        occupied ? "border-[var(--occupied)]" : "border-hairline",
      )}
      aria-labelledby="quick-kill-heading"
    >
      <div className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-2 text-[12px] text-ink-muted">
        <h2 id="quick-kill-heading">free a port</h2>
        <p className="flex items-center gap-3" aria-hidden>
          <KeyHint keys="⏎" label="kill" />
          {allowForceKill && <KeyHint keys="⇧⏎" label="force" />}
          <KeyHint keys="esc" label="clear" />
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 px-5 pt-4 pb-5">
        <div className="min-w-0 flex-1">
          {/* The number is the hero: everything else on this screen stays quiet. */}
          <div
            className="flex cursor-text items-baseline gap-3"
            onClick={() => inputRef.current?.focus()}
          >
            <span
              className={cn(
                "flex items-baseline font-mono text-[64px] leading-[1.1] font-semibold",
                occupied ? "text-[var(--occupied)]" : "text-ink",
              )}
            >
              <span aria-hidden className="text-ink-muted/60">
                :
              </span>
              <span className="relative inline-block">
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
                  onFocus={() => {
                    setFocused(true);
                    trackCaret();
                  }}
                  onBlur={() => setFocused(false)}
                  onSelect={trackCaret}
                  onChange={(event) =>
                    setValue(event.target.value.replace(/[^\d]/g, "").slice(0, 5))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      submit(event.shiftKey && allowForceKill);
                    } else if (event.key === "Escape" && value) {
                      event.preventDefault();
                      setValue("");
                    }
                  }}
                  style={{ width: `calc(${cells}ch + 6px)`, caretColor: "transparent" }}
                  className="bg-transparent p-0 font-semibold outline-none placeholder:text-ink-muted/30 focus-visible:outline-none"
                />
                {showCaret && (
                  // Keyed on the value and position so the blink restarts on
                  // every keystroke: solid while typing, blinking at rest.
                  <span
                    key={`${value}:${caret}`}
                    aria-hidden
                    className="animate-caret pointer-events-none absolute top-[0.14em] h-[0.9em] w-[3px] -translate-x-px rounded-full bg-[var(--focus)]"
                    style={{ left: `${caret}ch` }}
                  />
                )}
              </span>
            </span>

            {port !== null && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  void toggleFavorite();
                }}
                aria-pressed={isFavorite}
                aria-label={isFavorite ? "Remove from favourites" : "Save to favourites"}
                title={isFavorite ? "Remove from favourites" : "Save to favourites"}
                className="self-center rounded-sm p-1.5 text-ink-muted hover:bg-raised hover:text-ink"
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
            className="mt-1 flex min-h-[22px] flex-wrap items-baseline gap-x-3 text-[13.5px]"
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
            <Button size="lg" variant="outline" onClick={() => submit(true)}>
              Force kill
            </Button>
          )}
          <Button
            size="lg"
            variant="destructive"
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

function KeyHint({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="rounded-sm border border-hairline bg-raised px-1 font-mono text-[11px] leading-[16px] text-ink-soft">
        {keys}
      </kbd>
      {label}
    </span>
  );
}

/** The line under the prompt, written like the output of the command above it. */
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
    return <span className="text-[var(--danger)]">ports run from 1 to 65535</span>;
  }
  if (!value) {
    return <span className="text-ink-muted">type a port to see what is holding it</span>;
  }
  if ((checking && !status) || !status || status.port !== port) {
    return <span className="text-ink-muted">checking :{port}…</span>;
  }
  if (status.available) {
    return (
      <>
        <Dot className="bg-[var(--free)]" />
        <span className="text-[var(--free)]">free</span>
        <span className="text-ink-muted">nothing is using :{port}</span>
      </>
    );
  }

  const holder = status.entries[0];
  const extra = status.entries.length - 1;
  const project = holder.project;

  return (
    <>
      <Dot className="bg-[var(--occupied)]" />
      <span className="text-[var(--occupied)]">in use</span>
      <span className="font-mono font-semibold text-ink">{holder.processName}</span>
      {!holder.ownerUnknown && (
        <span className="font-mono text-ink-muted">pid {holder.pid}</span>
      )}
      {project && (
        <span className="text-ink-soft">
          {project.framework && project.framework !== project.name
            ? `${project.framework} in ${project.name}`
            : (project.framework ?? project.name)}
        </span>
      )}
      {extra > 0 && (
        <span className="text-ink-muted">
          +{extra} more {extra === 1 ? "process" : "processes"}
        </span>
      )}
    </>
  );
}

function Dot({ className }: { className: string }) {
  return (
    <span aria-hidden className={cn("size-2 shrink-0 self-center rounded-full", className)} />
  );
}
