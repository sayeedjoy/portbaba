import { memo, useEffect, useState } from "react";
import { AppWindow } from "lucide-react";

import {
  cachedProcessIcon,
  loadProcessIcon,
  processIconKey,
  type ProcessIconData,
} from "@/lib/processIcons";
import { cn } from "@/lib/utils";
import type { PortInfo } from "@/types/system";

/**
 * The brand mark of whatever owns a port. Unrecognised processes — and
 * recognised ones whose icon is still loading — get a plain window glyph in
 * the same box, so names stay aligned down the column.
 */
export const ProcessIcon = memo(function ProcessIcon({
  entry,
  className,
}: {
  entry: PortInfo;
  className?: string;
}) {
  const key = processIconKey(entry);
  const [icon, setIcon] = useState<ProcessIconData | undefined>(() =>
    key ? cachedProcessIcon(key) : undefined,
  );

  useEffect(() => {
    if (!key) return setIcon(undefined);
    const cached = cachedProcessIcon(key);
    if (cached) return setIcon(cached);
    setIcon(undefined);
    let live = true;
    loadProcessIcon(key).then(
      (data) => live && setIcon(data),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [key]);

  const box = cn("inline-flex size-4 shrink-0 items-center justify-center", className);

  if (!icon) {
    return <AppWindow aria-hidden className={cn(box, "text-ink-muted")} />;
  }

  const paint = "text-ink [&_svg]:size-full [&_svg]:fill-current";
  // Trusted markup from the bundled thesvg package, never from a process.
  if (icon.darkSvg) {
    return (
      <span aria-hidden title={icon.title} className={box}>
        <span
          className={cn(paint, "size-full dark:hidden")}
          dangerouslySetInnerHTML={{ __html: icon.svg }}
        />
        <span
          className={cn(paint, "hidden size-full dark:block")}
          dangerouslySetInnerHTML={{ __html: icon.darkSvg }}
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden
      title={icon.title}
      className={cn(box, paint)}
      style={icon.color ? { color: icon.color } : undefined}
      dangerouslySetInnerHTML={{ __html: icon.svg }}
    />
  );
});
