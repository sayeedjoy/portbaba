import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type Variant = "primary" | "danger" | "quiet" | "ghost";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

/**
 * Vermilion is reserved for termination, so `danger` is the only variant that
 * uses it. Everything else stays neutral and the destructive action never has
 * to compete for attention.
 */
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-ink text-panel hover:opacity-90 active:opacity-80 disabled:opacity-40",
  // Disabled destructive actions go grey rather than dim-red: a faded red
  // button still reads as armed, which is the wrong signal for "nothing to do".
  danger:
    "bg-[var(--danger)] text-white hover:bg-[var(--danger-hover)] active:brightness-95 disabled:bg-raised disabled:text-ink-muted",
  quiet:
    "bg-raised text-ink border border-hairline hover:border-hairline-strong hover:bg-sunken disabled:opacity-40",
  ghost:
    "text-ink-soft hover:text-ink hover:bg-raised disabled:opacity-40",
};

const SIZES: Record<Size, string> = {
  sm: "h-7 px-2.5 text-[13px] gap-1.5 rounded-md",
  md: "h-9 px-3.5 gap-2 rounded-lg",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "quiet", size = "md", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap font-medium",
        "transition-[background-color,border-color,opacity,color] duration-100",
        "disabled:pointer-events-none",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
});
