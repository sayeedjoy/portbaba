import { Toaster as Sonner, type ToasterProps } from "sonner";

import { useSettings } from "@/stores/settingsStore";

/**
 * shadcn ships this wired to `next-themes`. Port Killer is not a Next app, so
 * it reads the theme from the app's own settings and falls back to the OS when
 * the user has chosen "Match system".
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const choice = useSettings((s) => s.settings.theme);
  const theme: ToasterProps["theme"] = choice === "system" ? "system" : choice;

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--panel)",
          "--normal-text": "var(--ink)",
          "--normal-border": "var(--hairline)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
