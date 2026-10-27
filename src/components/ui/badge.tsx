import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "success" | "warning" | "danger" | "accent" }) {
  const tones = {
    neutral: "bg-sunken text-muted border-line",
    success: "bg-ok-soft text-ok border-ok/30",
    warning: "bg-warn-soft text-warn border-warn/30",
    danger: "bg-bad-soft text-bad border-bad/30",
    accent: "bg-accent-soft text-accent-ink border-accent/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] font-medium leading-4",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
