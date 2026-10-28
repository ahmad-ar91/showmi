import * as React from "react";
import { cn } from "@/lib/utils";

const toneColor = { ok: "var(--ok)", warn: "var(--warn)", bad: "var(--bad)" } as const;

function toneFor(score: number) {
  return score >= 75 ? "ok" : score >= 50 ? "warn" : "bad";
}

/** Large 0-100 score with a ring. One per view, for the headline number. */
export function ScoreDial({ score, size = 112, label }: { score: number; size?: number; label?: string }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label ?? `Score ${score} of 100`}>
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={r} stroke="var(--line)" strokeWidth="7" fill="none" />
        <circle
          cx="64"
          cy="64"
          r={r}
          stroke={toneColor[toneFor(score)]}
          strokeWidth="7"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(100, score)) / 100)}
          style={{ transition: "stroke-dashoffset 600ms ease-out" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-4xl tabular-nums">{score}</span>
    </div>
  );
}

/** Thin horizontal bar for a 0-100 value. `invert` when lower is better (difficulty). */
export function Meter({ value, invert = false, className }: { value: number; invert?: boolean; className?: string }) {
  const tone = invert ? toneFor(100 - value) : toneFor(value);
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-line/70">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: toneColor[tone] }} />
      </div>
      <span className="w-6 font-mono text-xs tabular-nums text-muted">{value}</span>
    </div>
  );
}

/** Label/value pair for compact facts. */
export function Stat({
  label,
  value,
  tone,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  tone?: "ok" | "warn" | "bad";
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={cn("mt-0.5 font-mono text-[15px] tabular-nums", tone ? { ok: "text-ok", warn: "text-warn", bad: "text-bad" }[tone] : "text-ink")}>
        {value}
      </dd>
    </div>
  );
}

/** Data table with the app's row rhythm. Pass <th>/<td> children as usual. */
export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table
        className={cn(
          "w-full text-left text-[13px] [&_tbody_tr]:border-t [&_tbody_tr]:border-line [&_tbody_tr:hover]:bg-sunken/70 [&_td]:px-5 [&_td]:py-2.5 [&_th]:px-5 [&_th]:pb-2 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted",
          className,
        )}
        {...props}
      />
    </div>
  );
}

/** Bulleted list where the marker colour carries meaning (weakness, strength, recommendation). */
export function MarkedList({ items, tone = "neutral" }: { items: React.ReactNode[]; tone?: "neutral" | "ok" | "bad" | "accent" }) {
  const marker = { neutral: "bg-line-strong", ok: "bg-ok", bad: "bg-bad", accent: "bg-accent" }[tone];
  return (
    <ul className="space-y-2.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 text-[13px] leading-relaxed text-ink">
          <span className={cn("mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full", marker)} aria-hidden />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}
