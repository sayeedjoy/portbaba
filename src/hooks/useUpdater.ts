import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import { useEffect } from "react";
import { toast } from "sonner";

// Checked once on launch rather than on a timer: portbaba is a long-lived tray
// app, and interrupting someone mid-port-hunt to announce a patch release is
// exactly the kind of nagging this app exists to avoid.
export function useUpdater() {
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const update = await check();
        if (!update || cancelled) return;

        toast(`portbaba ${update.version} is available`, {
          description: "Downloads in the background, then restarts.",
          duration: Infinity,
          action: {
            label: "Update",
            onClick: () => {
              void (async () => {
                try {
                  await update.downloadAndInstall();
                  await relaunch();
                } catch (error) {
                  toast.error("Update failed", { description: String(error) });
                }
              })();
            },
          },
        });
      } catch {
        // Offline, rate-limited, and "running an unsigned dev build" all land
        // here. None of them are worth a toast — the user did not ask.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
