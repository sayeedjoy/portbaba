import { useEffect, useState } from "react";

import * as api from "@/services/tauri";
import type { ProcessInfo } from "@/types/system";

/** FR-016 — loads the detail panel for one PID. */
export function useProcessDetails(pid: number | null) {
  const [process, setProcess] = useState<ProcessInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (pid === null) {
      setProcess(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .getProcessDetails(pid)
      .then((info) => {
        if (!cancelled) setProcess(info);
      })
      .catch((e: unknown) => {
        // §51 — the process may have exited between click and fetch.
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pid]);

  return { process, error, loading };
}
