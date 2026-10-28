"use client";

import { Spinner, Tag, TextButton } from "@/components/ui";
import type { UploadedScreenshot } from "@/lib/image";
import type { Segment } from "@/lib/types";
import { cn } from "@/lib/utils";

export const MAX_BADGES_PER_SHOT = 3;

export interface ShotSegmentation {
  status: "detecting" | "ready" | "error";
  segments: Segment[];
  selected: string[];
  mode?: "mock" | "live";
  error?: string;
}

interface Props {
  screenshot: UploadedScreenshot;
  index: number;
  state: ShotSegmentation | undefined;
  onToggle: (segmentId: string) => void;
  onRemove: () => void;
}

/**
 * Interactive SAM 3.1 overlay: every detected UI region is a clickable outline over the
 * screenshot. Selected regions become floating badges on the poster.
 */
export function SegmentPicker({ screenshot, index, state, onToggle, onRemove }: Props) {
  const selectedCount = state?.selected.length ?? 0;
  const full = selectedCount >= MAX_BADGES_PER_SHOT;

  return (
    <div className="rounded-lg bg-sunken p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-[13px] text-ink" title={screenshot.name}>
          <span className="mr-1.5 font-mono text-xs text-muted">{index + 1}</span>
          {screenshot.name}
        </p>
        <div className="flex shrink-0 items-center gap-3 text-xs">
          {state?.status === "detecting" && (
            <span className="flex items-center gap-1.5 text-muted">
              <Spinner size="sm" /> Finding regions
            </span>
          )}
          {state?.status === "ready" && (
            <Tag tone={full ? "warn" : "neutral"}>
              {selectedCount} of {MAX_BADGES_PER_SHOT} badges
            </Tag>
          )}
          {state?.status === "error" && <Tag tone="bad">Detection failed</Tag>}
          <TextButton className="text-xs text-muted hover:text-bad" onClick={onRemove}>
            Remove
          </TextButton>
        </div>
      </div>

      <div
        className="relative mx-auto overflow-hidden rounded-md bg-ink/90"
        style={{ aspectRatio: `${screenshot.width} / ${screenshot.height}`, maxHeight: 360 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={screenshot.dataUrl} alt={screenshot.name} className="h-full w-full object-contain" />

        {state?.status === "detecting" && <div className="absolute inset-0 animate-pulse bg-panel/30" />}

        {state?.status === "ready" &&
          state.segments.map((seg) => {
            const on = state.selected.includes(seg.id);
            const disabled = !on && full;
            return (
              <button
                key={seg.id}
                type="button"
                disabled={disabled}
                onClick={() => onToggle(seg.id)}
                aria-pressed={on}
                aria-label={`${on ? "Remove" : "Use"} ${seg.label} as a badge`}
                className={cn(
                  "group absolute rounded-[5px] transition-[background-color,box-shadow,opacity] duration-150 focus-visible:outline-offset-0",
                  on
                    ? "bg-accent/15 shadow-[0_0_0_2px_var(--accent),0_0_0_4px_rgba(255,255,255,0.9)]"
                    : "shadow-[0_0_0_1.5px_rgba(255,255,255,0.85),0_0_0_3px_rgba(23,25,30,0.35)] hover:bg-panel/15",
                  disabled ? "cursor-not-allowed opacity-30" : "cursor-pointer",
                )}
                style={{
                  left: `${seg.bbox.x * 100}%`,
                  top: `${seg.bbox.y * 100}%`,
                  width: `${seg.bbox.w * 100}%`,
                  height: `${seg.bbox.h * 100}%`,
                }}
              >
                {on && (
                  <span className="absolute -top-2.5 left-1.5 rounded bg-accent px-1.5 text-[10px] font-medium leading-4 text-white">
                    Badge
                  </span>
                )}
              </button>
            );
          })}
      </div>

      {state?.status === "ready" && (
        <p className="mt-2.5 text-xs leading-relaxed text-muted">
          Tap an outlined region to lift it off the phone as a badge
          {state.mode === "mock" ? ". These regions are simulated." : "."}
        </p>
      )}
      {state?.status === "error" && <p className="mt-2.5 text-xs text-bad">{state.error}</p>}
    </div>
  );
}
