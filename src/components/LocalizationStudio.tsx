"use client";

import { InputPanel } from "@/components/workspace/InputPanel";
import { PosterStudio } from "@/components/workspace/PosterStudio";
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
  featureArt: Record<string, string>;
  featureLoading: boolean;
  featureError: string | null;
  onGenerateFeatureArt: () => void;
  onRegisterExport: (fn: (() => Promise<void>) | null) => void;
}

/**
 * Step 2: the brief on the left, the review area on the right. A hand-off from the audit
 * injects the missing keywords and weaknesses into the copy prompt and pre-loads the weakest
 * screenshots.
 */
export function LocalizationStudio(p: LocalizationStudioProps) {
  const weaknessCount = p.handoff?.weaknesses.length ?? 0;
  return (
    <div className="flex flex-col gap-4 lg:h-full lg:min-h-0">
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

      <div className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(300px,340px)_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="lg:min-h-0">
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
        <div className="lg:min-h-0">
          <PosterStudio
            result={p.result}
            screenshots={p.screenshots}
            loading={p.loading}
            appName={p.appName}
            layout={p.layout}
            onLayoutChange={p.onLayoutChange}
            textPosition={p.textPosition}
            onTextPositionChange={p.onTextPositionChange}
            onMetadataChange={p.onMetadataChange}
            featureArt={p.featureArt}
            featureLoading={p.featureLoading}
            featureError={p.featureError}
            onGenerateFeatureArt={p.onGenerateFeatureArt}
            onRegisterExport={p.onRegisterExport}
          />
        </div>
      </div>
    </div>
  );
}
