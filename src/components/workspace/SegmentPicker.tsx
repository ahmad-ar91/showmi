"use client";

import { Check, Loader2, ScanSearch, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

const ACCENTS = ["#1f3fbf", "#1e7a4f", "#9a6a0f", "#b3261e"];

/**
 * Interactive SAM 3.1 overlay: every detected UI region is drawn as a clickable
 * bounding box over the screenshot. Selected regions become floating 3D badges on the poster.
 */
export function SegmentPicker({ screenshot, index, state, onToggle, onRemove }: Props) {
  const selectedCount = state?.selected.length ?? 0;
  const full = selectedCount >= MAX_BADGES_PER_SHOT;

  return (
    <div className="rounded-lg border border-line bg-sunken p-2">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="rounded bg-sunken px-1.5 py-0.5 text-[10px] font-semibold">#{index + 1}</span>
          <span className="max-w-[140px] truncate text-[11px] text-ink" title={screenshot.name}>
            {screenshot.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {state?.status === "detecting" && (
            <Badge tone="accent">
              <Loader2 size={10} className="animate-spin" /> SAM 3.1
            </Badge>
          )}
          {state?.status === "ready" && (
            <Badge tone={full ? "warning" : "success"}>
              {selectedCount}/{MAX_BADGES_PER_SHOT} badges
            </Badge>
          )}
          {state?.status === "error" && <Badge tone="danger">detect failed</Badge>}
          <button
            type="button"
            aria-label="Remove screenshot"
            onClick={onRemove}
            className="rounded-full p-1 text-muted hover:bg-sunken hover:text-panel"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      <div
        className="relative mx-auto overflow-hidden rounded-lg bg-black"
        style={{ aspectRatio: `${screenshot.width} / ${screenshot.height}`, maxHeight: 360 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={screenshot.dataUrl} alt={screenshot.name} className="h-full w-full object-contain" />

        {state?.status === "detecting" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="flex items-center gap-2 rounded-full bg-sunken/90 px-3 py-1.5 text-[11px] text-accent-ink">
              <ScanSearch size={13} className="animate-pulse" /> Detecting UI elements…
            </div>
          </div>
        )}

        {state?.status === "ready" &&
          state.segments.map((seg, i) => {
            const on = state.selected.includes(seg.id);
            const accent = ACCENTS[i % ACCENTS.length];
            const disabled = !on && full;
            return (
              <button
                key={seg.id}
                type="button"
                disabled={disabled}
                onClick={() => onToggle(seg.id)}
                title={`${seg.label} · ${(seg.score * 100).toFixed(0)}%`}
                className={cn(
                  "group absolute rounded-md transition-all focus:outline-none",
                  disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
                )}
                style={{
                  left: `${seg.bbox.x * 100}%`,
                  top: `${seg.bbox.y * 100}%`,
                  width: `${seg.bbox.w * 100}%`,
                  height: `${seg.bbox.h * 100}%`,
                  border: `2px ${on ? "solid" : "dashed"} ${accent}`,
                  background: on ? `${accent}33` : "transparent",
                  boxShadow: on ? `0 0 0 2px #ffffff, 0 0 0 3px ${accent}` : "none",
                }}
              >
                <span
                  className="absolute -top-2 left-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold leading-none text-white"
                  style={{ background: accent }}
                >
                  {on && <Check size={9} strokeWidth={3} />}
                  {seg.label}
                  <span className="opacity-70">{(seg.score * 100).toFixed(0)}%</span>
                </span>
                {!on && !disabled && (
                  <span className="absolute inset-0 hidden items-center justify-center text-[10px] font-medium text-panel group-hover:flex">
                    <span className="rounded bg-ink/80 px-2 py-0.5">Make badge</span>
                  </span>
                )}
              </button>
            );
          })}
      </div>

      {state?.status === "ready" && (
        <p className="mt-2 px-1 text-[10px] text-muted">
          Click a detected region to float it out of the phone as a 3D badge
          {state.mode === "mock" ? " (simulated regions)" : ""}.
        </p>
      )}
      {state?.status === "error" && <p className="mt-2 px-1 text-[10px] text-bad">{state.error}</p>}
    </div>
  );
}
