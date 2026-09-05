import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

interface SelectProps<T extends string | number> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  label?: string;
  hint?: string;
  className?: string;
  disabled?: boolean;
}

export function Select<T extends string | number>({
  value,
  onChange,
  options,
  label,
  hint,
  className,
  disabled,
}: SelectProps<T>) {
  const control = (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => {
          const raw = event.target.value;
          const match = options.find((o) => String(o.value) === raw);
          if (match) onChange(match.value);
        }}
        className={cn(
          "h-9 appearance-none rounded-lg border border-hairline bg-raised pl-3 pr-8",
          "hover:border-hairline-strong disabled:opacity-50",
        )}
      >
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-ink-muted"
      />
    </span>
  );

  if (!label) return control;

  return (
    <div className="flex items-start justify-between gap-6 py-3">
      <span className="min-w-0">
        <span className="block text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-[13px] text-ink-muted">{hint}</span>}
      </span>
      {control}
    </div>
  );
}
