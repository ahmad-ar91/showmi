import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The single container surface. Cards are not nested: inside a card, group content with
 * spacing and <Divider>, or with a sunken <Well>.
 */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn("flex min-h-0 flex-col rounded-xl border border-line bg-panel shadow-card", className)}
      {...props}
    />
  );
}

export interface CardHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Buttons or controls aligned to the right. */
  actions?: React.ReactNode;
  className?: string;
}

/** Title, one line of context and optional actions. No icon slot by design. */
export function CardHeader({ title, description, actions, className }: CardHeaderProps) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-5 pb-3 pt-5", className)}>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-lg leading-snug text-ink">{title}</h2>
        {description && <p className="mt-0.5 max-w-prose text-[13px] leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function CardBody({ className, scroll = false, ...props }: React.HTMLAttributes<HTMLDivElement> & { scroll?: boolean }) {
  return <div className={cn("px-5 pb-5", scroll && "min-h-0 flex-1 overflow-y-auto", className)} {...props} />;
}

/** Toolbar strip under a header, for view controls. */
export function CardToolbar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-wrap items-center gap-2 px-5 pb-4", className)} {...props} />;
}

/** Sunken area inside a card for grouped or secondary content. */
export function Well({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg bg-sunken p-4", className)} {...props} />;
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-line", className)} />;
}
