import * as React from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

const noticeTones = {
  info: "border-accent/25 bg-accent-soft/60 text-ink",
  warn: "border-warn/30 bg-warn-soft text-ink",
  bad: "border-bad/30 bg-bad-soft text-ink",
} as const;

const noticeBar = { info: "bg-accent", warn: "bg-warn", bad: "bg-bad" } as const;

/** Inline message about the current view. Errors say what happened and what to do next. */
export function Notice({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: keyof typeof noticeTones;
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "bad" ? "alert" : "status"}
      className={cn("relative flex items-start gap-3 overflow-hidden rounded-lg border py-3 pl-4 pr-3 text-[13px]", noticeTones[tone], className)}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", noticeBar[tone])} aria-hidden />
      <div className="min-w-0 flex-1 leading-relaxed">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "text-ink/80")}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** What a region shows before it has content. Invites the next action instead of decorating. */
export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex h-full flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <p className="font-display text-xl text-ink">{title}</p>
      {children && <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Full-region loading state with a sentence about what is happening. */
export function Working({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex h-full flex-col items-center justify-center gap-4 px-6 py-12 text-center", className)}>
      <Spinner size="lg" className="text-accent" />
      <p className="max-w-sm text-[13px] leading-relaxed text-muted">{children}</p>
    </div>
  );
}
