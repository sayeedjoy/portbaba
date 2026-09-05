import { Check, TriangleAlert, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useUi } from "@/stores/uiStore";

const TONE = {
  success: { icon: Check, accent: "text-[var(--free)]" },
  danger: { icon: TriangleAlert, accent: "text-[var(--danger)]" },
  info: { icon: Check, accent: "text-ink-soft" },
} as const;

/** §53/§54 — results are reported in place; nothing is silently swallowed. */
export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismissToast);

  if (!toasts.length) return null;

  return (
    <div
      className="pointer-events-none fixed right-5 bottom-5 z-40 flex w-[380px] flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const { icon: Icon, accent } = TONE[toast.tone];
        return (
          <div
            key={toast.id}
            className="animate-dialog pointer-events-auto flex items-start gap-3 rounded-xl border border-hairline bg-panel p-3 pr-2 shadow-[var(--shadow-lift)]"
          >
            <Icon aria-hidden className={cn("mt-0.5 h-4 w-4 shrink-0", accent)} />
            <p className="min-w-0 flex-1 text-[13.5px] leading-snug text-ink">
              {toast.message}
            </p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss"
              className="-mt-0.5 rounded-md p-1 text-ink-muted hover:bg-raised hover:text-ink"
            >
              <X aria-hidden className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
