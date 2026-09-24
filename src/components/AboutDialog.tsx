import type { ReactNode } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Code2, ExternalLink, History } from "lucide-react";

import appIcon from "../../src-tauri/icons/128x128@2x.png";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSettings } from "@/stores/settingsStore";
import { useUi } from "@/stores/uiStore";

const REPO = "sayeedjoy/portbaba";
const AUTHOR = { name: "Sayeed Joy", url: "https://github.com/sayeedjoy" };

/** What portbaba is, which build this is, and where it comes from. */
export function AboutDialog() {
  const open = useUi((s) => s.aboutOpen);
  const setOpen = useUi((s) => s.setAboutOpen);
  const version = useSettings((s) => s.system?.appVersion);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="gap-0 rounded-md border-hairline bg-panel p-0 shadow-[var(--shadow-lift)] sm:max-w-[420px]">
        <div className="flex flex-col items-center px-6 pt-8 pb-6 text-center">
          <img src={appIcon} alt="" className="size-16" draggable={false} />
          <DialogTitle className="mt-4 font-mono text-[18px] font-semibold">
            portbaba
          </DialogTitle>
          {version && (
            <p className="mt-1 font-mono text-[12.5px] text-ink-muted">v{version}</p>
          )}
          <DialogDescription className="mt-2 text-ink-soft">
            Find it. Kill it. Free the port.
          </DialogDescription>
        </div>

        <dl className="mx-6 border-y border-hairline py-2">
          <LinkRow
            icon={<Code2 aria-hidden />}
            label="Repository"
            onClick={() => void openUrl(`https://github.com/${REPO}`)}
          >
            <span className="font-mono text-[12px] text-ink-muted">{REPO}</span>
          </LinkRow>
          <LinkRow
            icon={<History aria-hidden />}
            label="Release notes"
            onClick={() =>
              void openUrl(
                version
                  ? `https://github.com/${REPO}/releases/tag/v${version}`
                  : `https://github.com/${REPO}/releases`,
              )
            }
          >
            <ExternalLink aria-hidden className="size-3.5 text-ink-muted" />
          </LinkRow>
        </dl>

        <div className="flex items-center gap-2 px-6 py-4">
          <p className="mr-auto text-[12.5px] text-ink-muted">
            Built by{" "}
            <button
              type="button"
              onClick={() => void openUrl(AUTHOR.url)}
              className="text-[var(--focus)] hover:underline"
            >
              {AUTHOR.name}
            </button>
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-8 rounded-sm px-3 text-[13px] font-medium text-ink-soft hover:bg-raised hover:text-ink"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LinkRow({
  icon,
  label,
  onClick,
  children,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center">
      <dt className="text-ink-muted [&_svg]:size-4">{icon}</dt>
      <dd className="flex-1">
        <button
          type="button"
          onClick={onClick}
          className="flex w-full items-center justify-end gap-2 rounded-md py-2 pl-3 text-ink-soft hover:text-ink"
        >
          {label}
          {children}
        </button>
      </dd>
    </div>
  );
}
