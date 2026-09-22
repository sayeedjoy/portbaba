import { useSyncExternalStore } from "react";

import { useSettings } from "@/stores/settingsStore";

const query = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** The theme actually on screen: "system" resolved against the OS preference. */
export function useResolvedTheme(): "light" | "dark" {
  const theme = useSettings((s) => s.settings.theme);
  const systemDark = useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
  if (theme === "system") return systemDark ? "dark" : "light";
  return theme;
}
