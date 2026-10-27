"use client";

import { ArrowDownToLine, Languages, Wand2 } from "lucide-react";
import { InputPanel } from "@/components/workspace/InputPanel";
import { PosterStudio } from "@/components/workspace/PosterStudio";
import { MetadataInspector } from "@/components/workspace/MetadataInspector";
import type { ShotSegmentation } from "@/components/workspace/SegmentPicker";
import { Badge } from "@/components/ui/badge";
import type { UploadedScreenshot } from "@/lib/image";
import type { GenerateAsoResponse, LayoutStyle, LocaleCode, PlayStoreMetadata, TextPosition } from "@/lib/types";

/** Data carried from the ASO Analytics tab into the studio. */
export interface StudioHandoff {
  sourceApp: string;
  keywords: string[];
  weaknesses: string[];
  recommendations: string[];
}

export interface LocalizationStudioProps {
  handoff: StudioHandoff | null;
  onClearHandoff: () => void;
  screenshots: UploadedScreenshot[];
  onScreenshotsChange: (next: UploadedScreenshot[]) => void;
  segmentation: Record<string, ShotSegmentation>;
  onToggleSegment: (screenshotId: string, segmentId: string) => void;
  appName: string;
  onAppNameChange: (v: string) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  selectedLocales: LocaleCode[];
  onToggleLocale: (code: LocaleCode) => void;
  onGenerate: () => void;
  loading: boolean;
  mode: "mock" | "live" | "unknown";
  result: GenerateAsoResponse | null;
  layout: LayoutStyle;
  onLayoutChange: (l: LayoutStyle) => void;
  textPosition: TextPosition;
  onTextPositionChange: (p: TextPosition) => void;
  onMetadataChange: (locale: LocaleCode, field: keyof PlayStoreMetadata, value: string) => void;
  onRegisterExport: (fn: (() => Promise<void>) | null) => void;
}

/**
 * Tab 2: the three-panel multimodal studio (input → poster canvas → metadata inspector).
 * When it receives a hand-off from the analytics tab, missing keywords and weaknesses are
 * injected into the Muse Spark prompt and the weakest screenshots are pre-loaded.
 */
export function LocalizationStudio(p: LocalizationStudioProps) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {p.handoff && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-violet-500/40 bg-violet-500/10 px-4 py-2.5 text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-violet-200">
            <ArrowDownToLine size={14} /> From audit of {p.handoff.sourceApp}
          </span>
          <span className="text-zinc-400">·</span>
          <span className="flex items-center gap-1 text-zinc-300">
            <Languages size={12} /> Injecting keywords:
          </span>
          {p.handoff.keywords.slice(0, 8).map((k) => (
            <Badge key={k} tone="accent">
              {k}
            </Badge>
          ))}
          <span className="text-zinc-400">·</span>
          <span className="flex items-center gap-1 text-zinc-300">
            <Wand2 size={12} /> Fixing {p.handoff.weaknesses.length} weakness{p.handoff.weaknesses.length === 1 ? "" : "es"}
          </span>
          <button type="button" onClick={p.onClearHandoff} className="ml-auto text-[11px] text-zinc-400 hover:text-white">
            Clear hand-off
          </button>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto lg:grid-cols-[320px_minmax(0,1fr)_360px] lg:overflow-hidden xl:grid-cols-[340px_minmax(0,1fr)_400px]">
        <div className="min-h-[520px] lg:min-h-0">
          <InputPanel
            screenshots={p.screenshots}
            onScreenshotsChange={p.onScreenshotsChange}
            segmentation={p.segmentation}
            onToggleSegment={p.onToggleSegment}
            appName={p.appName}
            onAppNameChange={p.onAppNameChange}
            description={p.description}
            onDescriptionChange={p.onDescriptionChange}
            selectedLocales={p.selectedLocales}
            onToggleLocale={p.onToggleLocale}
            onGenerate={p.onGenerate}
            loading={p.loading}
            mode={p.mode}
          />
        </div>
        <div className="min-h-[720px] lg:min-h-0">
          <PosterStudio
            result={p.result}
            screenshots={p.screenshots}
            loading={p.loading}
            layout={p.layout}
            onLayoutChange={p.onLayoutChange}
            textPosition={p.textPosition}
            onTextPositionChange={p.onTextPositionChange}
            onRegisterExport={p.onRegisterExport}
          />
        </div>
        <div className="min-h-[520px] lg:min-h-0">
          <MetadataInspector results={p.result?.locales ?? null} onMetadataChange={p.onMetadataChange} />
        </div>
      </div>
    </div>
  );
}
