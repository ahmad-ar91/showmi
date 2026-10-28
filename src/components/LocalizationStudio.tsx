"use client";

import { InputPanel } from "@/components/workspace/InputPanel";
import { PosterStudio } from "@/components/workspace/PosterStudio";
import { MetadataInspector } from "@/components/workspace/MetadataInspector";
import type { ShotSegmentation } from "@/components/workspace/SegmentPicker";
import { Notice, Tag, TextButton } from "@/components/ui";
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
 * Step 2: brief, posters and listing text side by side. A hand-off from the audit injects
 * the missing keywords and weaknesses into the copy prompt and pre-loads the weakest screenshots.
 */
export function LocalizationStudio(p: LocalizationStudioProps) {
  const weaknessCount = p.handoff?.weaknesses.length ?? 0;
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {p.handoff && (
        <Notice
          tone="info"
          title={`Working from the audit of ${p.handoff.sourceApp}`}
          action={
            <TextButton className="text-xs text-muted hover:text-ink" onClick={p.onClearHandoff}>
              Dismiss
            </TextButton>
          }
        >
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="mr-1">The copy will work in</span>
            {p.handoff.keywords.slice(0, 8).map((k) => (
              <Tag key={k} tone="accent">
                {k}
              </Tag>
            ))}
            <span className="ml-1">
              and address {weaknessCount} weakness{weaknessCount === 1 ? "" : "es"}.
            </span>
          </div>
        </Notice>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto lg:grid-cols-[340px_minmax(0,1fr)_360px] lg:overflow-hidden xl:grid-cols-[360px_minmax(0,1fr)_400px]">
        <div className="min-h-[560px] lg:min-h-0">
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
        <div className="min-h-[560px] lg:min-h-0">
          <MetadataInspector results={p.result?.locales ?? null} onMetadataChange={p.onMetadataChange} />
        </div>
      </div>
    </div>
  );
}
