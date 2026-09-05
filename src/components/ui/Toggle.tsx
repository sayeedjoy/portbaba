import { cn } from "@/lib/utils";

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}

/** A settings row: the label is the control, so the whole line is clickable. */
export function Toggle({ checked, onChange, label, hint, disabled }: ToggleProps) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start justify-between gap-6 py-3",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span className="min-w-0">
        <span className="block text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-[13px] text-ink-muted">{hint}</span>}
      </span>
      <span className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span
          aria-hidden
          className={cn(
            "block h-[22px] w-[38px] rounded-full border transition-colors duration-150",
            "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus)]",
            checked
              ? "border-transparent bg-ink"
              : "border-hairline-strong bg-sunken",
          )}
        />
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-[3px] left-[3px] h-4 w-4 rounded-full bg-panel shadow-sm transition-transform duration-150",
            checked && "translate-x-4",
          )}
        />
      </span>
    </label>
  );
}
