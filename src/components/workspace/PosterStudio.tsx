"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, CardHeader, EmptyState, Notice, SegmentedControl, Tag, TextButton, Working } from "@/components/ui";
import { PosterCanvas } from "./PosterCanvas";
import { LOCALE_MAP } from "@/lib/locales";
import type { UploadedScreenshot } from "@/lib/image";
import { downloadPosterPng, exportFastlaneZip, type PosterNodeRef } from "@/lib/export";
import type { GenerateAsoResponse, LayoutStyle, TextPosition } from "@/lib/types";

interface Props {
  result: GenerateAsoResponse | null;
  screenshots: UploadedScreenshot[];
  loading: boolean;
  layout: LayoutStyle;
  onLayoutChange: (l: LayoutStyle) => void;
  textPosition: TextPosition;
  onTextPositionChange: (p: TextPosition) => void;
  /** Lets other tabs (Store Simulator) trigger the same Fastlane export. */
  onRegisterExport?: (fn: (() => Promise<void>) | null) => void;
}

const LAYOUTS = [
  { value: "classic" as const, label: "Classic" },
  { value: "tilt" as const, label: "Tilt" },
  { value: "offset" as const, label: "Offset" },
];

const POSITIONS = [
  { value: "top" as const, label: "Text top" },
  { value: "bottom" as const, label: "Text bottom" },
];

export function PosterStudio({
  result,
  screenshots,
  loading,
  layout,
  onLayoutChange,
  textPosition,
  onTextPositionChange,
  onRegisterExport,
}: Props) {
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const [exporting, setExporting] = useState<null | { done: number; total: number }>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const register = useCallback(
    (key: string) => (el: HTMLDivElement | null) => {
      if (el) nodes.current.set(key, el);
      else nodes.current.delete(key);
    },
    [],
  );

  const collectRefs = (): PosterNodeRef[] => {
    if (!result) return [];
    const refs: PosterNodeRef[] = [];
    result.locales.forEach((r) => {
      screenshots.forEach((_, i) => {
        const node = nodes.current.get(`${r.locale}-${i}`);
        if (node) refs.push({ locale: r.locale, index: i, node });
      });
    });
    return refs;
  };

  const handleExportAll = async () => {
    if (!result) return;
    setExportError(null);
    try {
      await exportFastlaneZip(result.locales, collectRefs(), (done, total) => setExporting({ done, total }));
    } catch (err) {
      setExportError((err as Error).message);
    } finally {
      setExporting(null);
    }
  };

  const exportRef = useRef(handleExportAll);
  useEffect(() => {
    exportRef.current = handleExportAll;
  });
  useEffect(() => {
    onRegisterExport?.(() => exportRef.current());
    return () => onRegisterExport?.(null);
  }, [onRegisterExport]);

  const handleDownloadOne = async (ref: PosterNodeRef) => {
    const key = `${ref.locale}-${ref.index}`;
    setDownloading(key);
    setExportError(null);
    try {
      await downloadPosterPng(ref);
    } catch (err) {
      setExportError((err as Error).message);
    } finally {
      setDownloading(null);
    }
  };

  const posterCount = result ? result.locales.length * screenshots.length : 0;

  return (
    <Card className="h-full overflow-hidden">
      <CardHeader
        title="Posters"
        description={
          result
            ? `${posterCount} poster${posterCount === 1 ? "" : "s"}, 1080 by 1920.`
            : "1080 by 1920, Play Store ready."
        }
        actions={
          <Button variant="primary" size="sm" disabled={!result || loading} loading={!!exporting} onClick={handleExportAll}>
            {exporting ? `Rendering ${exporting.done} of ${exporting.total}` : "Download Fastlane ZIP"}
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-2 px-5 pb-4">
        <SegmentedControl label="Poster layout" options={LAYOUTS} value={layout} onChange={onLayoutChange} />
        <SegmentedControl label="Headline position" options={POSITIONS} value={textPosition} onChange={onTextPositionChange} />
      </div>
      {exportError && (
        <Notice tone="bad" title="The export stopped" className="mx-5 mb-4">
          {exportError} Try again, or download posters one at a time.
        </Notice>
      )}

      <div className="grid-bg min-h-0 flex-1 overflow-y-auto border-t border-line px-5 py-6">
        {!result && !loading && (
          <EmptyState title="Nothing generated yet">
            Add screenshots and a short description, choose markets, then generate. Posters for every market appear here.
          </EmptyState>
        )}
        {loading && <Working>Finding UI regions, writing copy for each market and painting backgrounds.</Working>}
        {result && !loading && (
          <div className="space-y-10">
            {result.warnings.length > 0 && (
              <Notice tone="warn" title="Some model calls fell back to simulated output">
                <ul className="list-disc space-y-0.5 pl-4">
                  {result.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </Notice>
            )}
            {result.locales.map((r) => {
              const loc = LOCALE_MAP[r.locale];
              return (
                <section key={r.locale}>
                  <div className="mb-4 max-w-2xl">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-lg leading-tight">{loc.label}</h3>
                      <span className="font-mono text-xs text-muted">{loc.playStoreCode}</span>
                      {loc.rtl && <Tag>Right to left</Tag>}
                    </div>
                    {r.culturalNote && <p className="mt-1 text-[13px] leading-relaxed text-muted">{r.culturalNote}</p>}
                  </div>
                  <div className="flex gap-6 overflow-x-auto pb-2">
                    {screenshots.map((shot, i) => {
                      const key = `${r.locale}-${i}`;
                      const copy = r.posters[i] ?? r.posters[0] ?? { headline: "", subheadline: "" };
                      return (
                        <figure key={key} className="flex shrink-0 flex-col gap-2.5">
                          <div className="overflow-hidden rounded-[18px] shadow-pop">
                            <PosterCanvas
                              ref={register(key)}
                              locale={r.locale}
                              screenshot={shot}
                              segments={result.segments[i] ?? []}
                              copy={copy}
                              backgroundDataUrl={r.backgroundDataUrl}
                              layout={layout}
                              textPosition={textPosition}
                            />
                          </div>
                          <figcaption className="flex items-center justify-between px-0.5 text-xs">
                            <span className="text-muted">Screenshot {i + 1}</span>
                            <TextButton
                              className="text-xs"
                              disabled={downloading === key}
                              onClick={() => {
                                const node = nodes.current.get(key);
                                if (node) void handleDownloadOne({ locale: r.locale, index: i, node });
                              }}
                            >
                              {downloading === key ? "Saving" : "Save PNG"}
                            </TextButton>
                          </figcaption>
                        </figure>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
