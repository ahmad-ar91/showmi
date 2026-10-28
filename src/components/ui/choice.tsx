"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface Option<T extends string> {
  value: T;
  label: React.ReactNode;
}

/** Mutually exclusive view options (layout, text position). Max ~4 options. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible group name. */
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-lg bg-sunken p-0.5 ring-1 ring-inset ring-line", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-7 rounded-md px-3 text-[13px] font-medium transition-[background-color,color,box-shadow] duration-150",
              on ? "bg-panel text-ink shadow-[0_1px_2px_rgba(23,25,30,0.12)]" : "text-muted hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Underline tabs for switching between peers of the same thing (e.g. locales). */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: { value: T; label: React.ReactNode; flagged?: boolean }[];
  value: T | null;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cn("flex gap-4 overflow-x-auto border-b border-line", className)}>
      {items.map((it) => {
        const on = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(it.value)}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 pb-2 pt-1 text-[13px] transition-colors",
              on ? "border-ink font-medium text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {it.label}
            {it.flagged && <span className="h-1.5 w-1.5 rounded-full bg-bad" aria-label="Needs attention" />}
          </button>
        );
      })}
    </div>
  );
}

/** Checkbox row used in lists: the whole row is the hit area. */
export function CheckRow({
  checked,
  onChange,
  children,
  aside,
  className,
}: {
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        checked ? "bg-accent-soft/70 text-ink" : "hover:bg-sunken",
        className,
      )}
    >
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--accent)]" />
      <span className="min-w-0 flex-1">{children}</span>
      {aside}
    </label>
  );
}
