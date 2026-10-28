"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Shows fixed-size artwork (a poster or feature graphic) at another display width.
 * The artwork itself keeps its native size, so exports from it stay pixel-exact.
 */
export function ScaledFrame({
  width,
  height,
  displayWidth,
  className,
  children,
}: {
  width: number;
  height: number;
  displayWidth: number;
  className?: string;
  children: React.ReactNode;
}) {
  const scale = displayWidth / width;
  return (
    <div className={cn("relative shrink-0 overflow-hidden", className)} style={{ width: displayWidth, height: height * scale }}>
      <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}>{children}</div>
    </div>
  );
}

/** Scales artwork to fill the available width (and height, when `fitHeight`) of its container. */
export function FitFrame({
  width,
  height,
  maxWidth = Infinity,
  fitHeight = false,
  className,
  children,
}: {
  width: number;
  height: number;
  maxWidth?: number;
  fitHeight?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width: w, height: h } = entry.contentRect;
      const byHeight = fitHeight && h > 0 ? (h * width) / height : Infinity;
      setDisplay(Math.max(0, Math.floor(Math.min(w, byHeight, maxWidth))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height, maxWidth, fitHeight]);

  return (
    <div ref={box} className={cn("flex w-full min-w-0 items-center justify-center", fitHeight && "h-full min-h-0", className)}>
      {display > 0 && (
        <ScaledFrame width={width} height={height} displayWidth={display}>
          {children}
        </ScaledFrame>
      )}
    </div>
  );
}
