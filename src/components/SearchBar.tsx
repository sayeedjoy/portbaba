import { forwardRef, useImperativeHandle, useRef } from "react";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";

export interface SearchHandle {
  focus: () => void;
}

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/** FR-002 / FR-003 / FR-021 — one field for ports, names and ranges. */
export const SearchBar = forwardRef<SearchHandle, SearchBarProps>(function SearchBar(
  { value, onChange, placeholder = "Search a port, process or range", className },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => ({
    focus() {
      inputRef.current?.focus();
      inputRef.current?.select();
    },
  }));

  return (
    <div
      className={cn(
        "flex h-9 items-center gap-2 rounded-lg border border-hairline bg-raised px-3",
        "focus-within:border-hairline-strong",
        className,
      )}
    >
      <Search aria-hidden className="h-4 w-4 shrink-0 text-ink-muted" />
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value) {
            event.stopPropagation();
            onChange("");
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        spellCheck={false}
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-muted"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="rounded p-0.5 text-ink-muted hover:text-ink"
        >
          <X aria-hidden className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
});
