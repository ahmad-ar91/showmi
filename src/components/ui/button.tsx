import * as React from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  /** The one main action of a view. */
  primary: "bg-accent text-white hover:bg-accent-ink shadow-[0_1px_0_rgba(0,0,0,0.12)]",
  /** Any other action. */
  secondary: "border border-line-strong bg-panel text-ink hover:border-ink/40 hover:bg-sunken",
  /** Low-emphasis action inside dense areas. */
  quiet: "text-muted hover:bg-sunken hover:text-ink",
  /** Destructive action. */
  danger: "border border-bad/30 bg-panel text-bad hover:bg-bad-soft",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] gap-2",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-[15px] gap-2.5",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, disables the button and keeps the label so width does not jump. */
  loading?: boolean;
  /** Stretches to the container width. */
  block?: boolean;
}

/** Text-only button. Labels are verbs ("Generate listing", "Download ZIP"); no icons. */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "secondary", size = "md", type = "button", loading = false, block = false, disabled, children, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition-[background-color,border-color,color,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-45",
        variants[variant],
        sizes[size],
        block && "w-full",
        className,
      )}
      {...props}
    >
      {loading && <Spinner size={size === "lg" ? "md" : "sm"} />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

/** Inline, link-styled action for secondary choices inside text ("Clear", "Load sample"). */
export function TextButton({ className, type = "button", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        "rounded-sm font-medium text-accent underline-offset-4 transition-colors hover:text-accent-ink hover:underline disabled:opacity-45",
        className,
      )}
      {...props}
    />
  );
}
