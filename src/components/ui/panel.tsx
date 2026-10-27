import * as React from "react";
import { cn } from "@/lib/utils";

export function Panel({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn("flex min-h-0 flex-col rounded-lg border border-line bg-panel", className)} {...props} />
  );
}

export function PanelHeader({
  icon,
  title,
  subtitle,
  right,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
      <div className="flex items-center gap-2.5">
        {icon && <span className="text-muted">{icon}</span>}
        <div>
          <h2 className="font-display text-[17px] font-medium leading-tight text-ink">{title}</h2>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      {right}
    </header>
  );
}

export function PanelBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto p-4", className)} {...props} />;
}
