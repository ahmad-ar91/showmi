import * as React from "react";
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "accent" | "ok" | "warn" | "bad";

const tones: Record<Tone, string> = {
  neutral: "bg-sunken text-muted ring-line",
  accent: "bg-accent-soft text-accent-ink ring-accent/20",
  ok: "bg-ok-soft text-ok ring-ok/20",
  warn: "bg-warn-soft text-warn ring-warn/25",
  bad: "bg-bad-soft text-bad ring-bad/20",
};

/** Maps a 0-100 score to a tone: 75+ ok, 50+ warn, below bad. */
export function scoreTone(score: number): "ok" | "warn" | "bad" {
  return score >= 75 ? "ok" : score >= 50 ? "warn" : "bad";
}

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  /** Renders a remove control after the label. */
  onRemove?: () => void;
  removeLabel?: string;
}

/** Short status or category text. Never decorative: every tag must say something. */
export function Tag({ tone = "neutral", onRemove, removeLabel = "Remove", className, children, ...props }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium leading-5 ring-1 ring-inset",
        tones[tone],
        className,
      )}
      {...props}
    >
      <span className="truncate">{children}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${removeLabel} ${typeof children === "string" ? children : ""}`.trim()}
          className="-mr-1 rounded px-1 text-current opacity-60 transition-opacity hover:opacity-100"
        >
          ×
        </button>
      )}
    </span>
  );
}
