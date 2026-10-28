import * as React from "react";
import { cn } from "@/lib/utils";

export interface FieldProps {
  label: React.ReactNode;
  htmlFor?: string;
  /** Right-aligned text on the label row: a counter, "Optional", or a small action. */
  aside?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** Label, control, then hint or error. Every form control in the app goes through this. */
export function Field({ label, htmlFor, aside, hint, error, className, children }: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
          {label}
        </label>
        {aside && <span className="text-xs text-muted">{aside}</span>}
      </div>
      {children}
      {error ? (
        <p className="text-xs text-bad">{error}</p>
      ) : hint ? (
        <p className="text-xs leading-relaxed text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

const control =
  "w-full rounded-lg border bg-panel text-sm text-ink placeholder:text-faint transition-[border-color,box-shadow] duration-150 focus:outline-none focus:ring-4 disabled:opacity-60";
const states = {
  normal: "border-line-strong/70 hover:border-line-strong focus:border-accent focus:ring-accent/12",
  invalid: "border-bad focus:border-bad focus:ring-bad/12",
};

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, invalid, ...props }, ref) => (
  <input ref={ref} className={cn(control, "h-10 px-3", invalid ? states.invalid : states.normal, className)} {...props} />
));
Input.displayName = "Input";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean };

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, invalid, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(control, "resize-y px-3 py-2.5 leading-relaxed", invalid ? states.invalid : states.normal, className)}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select ref={ref} className={cn(control, states.normal, "h-9 cursor-pointer px-2.5 pr-8", className)} {...props} />
  ),
);
Select.displayName = "Select";

/** Character counter for Play Console limits: warns at 90%, turns red over the limit. */
export function Counter({ count, limit }: { count: number; limit: number }) {
  const over = count > limit;
  const near = !over && count >= limit * 0.9;
  return (
    <span className={cn("font-mono tabular-nums", over ? "text-bad" : near ? "text-warn" : "text-muted")}>
      {count}/{limit}
    </span>
  );
}
