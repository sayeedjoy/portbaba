import { Star } from "lucide-react";

import { cn } from "@/lib/utils";
import type { FavoritePort, PortInfo } from "@/types/system";

interface PortBerthProps {
  favorite: FavoritePort;
  holder?: PortInfo;
  onFree: (port: number) => void;
  onInspect: (pid: number) => void;
  onRemove?: (id: string) => void;
  justFreed: boolean;
}

/**
 * FR-012 + FR-013 — a favourite port as an occupancy berth: the number, and
 * whether anything is sitting in it. Occupied berths carry colour because they
 * are the ones you might want to act on; free berths stay quiet.
 */
export function PortBerth({
  favorite,
  holder,
  onFree,
  onInspect,
  onRemove,
  justFreed,
}: PortBerthProps) {
  const occupied = Boolean(holder);

  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between rounded-xl border bg-panel p-3.5 transition-colors duration-150",
        occupied
          ? "border-[var(--occupied)]/45 bg-[var(--occupied-wash)]"
          : "border-hairline",
        justFreed && "animate-freed",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className={cn(
              "text-[26px] leading-none font-bold tracking-[-0.02em]",
              occupied && "text-[var(--occupied)]",
            )}
          >
            {favorite.port}
          </p>
          <p className="mt-1.5 truncate text-[13px] text-ink-soft">{favorite.label}</p>
        </div>

        {onRemove && (
          <button
            type="button"
            onClick={() => onRemove(favorite.id)}
            aria-label={`Remove port ${favorite.port} from favourites`}
            className="rounded p-1 text-ink-muted opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-ink"
          >
            <Star aria-hidden className="h-3.5 w-3.5 fill-current" />
          </button>
        )}
      </div>

      <div className="mt-3 min-h-[28px]">
        {holder ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onInspect(holder.pid)}
              className="min-w-0 flex-1 truncate rounded px-1 py-0.5 text-left text-[13px] text-ink hover:bg-panel/60"
              title={`${holder.processName} — PID ${holder.pid}`}
            >
              {holder.processName}
            </button>
            <button
              type="button"
              onClick={() => onFree(favorite.port)}
              className="shrink-0 rounded-md border border-[var(--danger)]/35 px-2 py-1 text-[12.5px] font-medium text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white"
            >
              Kill
            </button>
          </div>
        ) : (
          <p className="px-1 text-[13px] text-ink-muted">Available</p>
        )}
      </div>
    </div>
  );
}
