"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Card, CardHeader, EmptyState, Notice, SegmentedControl, Tabs, Tag, TextButton, Working } from "@/components/ui";
import { PosterCanvas } from "./PosterCanvas";
import { FeatureGraphic } from "./FeatureGraphic";
import { FitFrame } from "./frames";
import { Lightbox, type LightboxItem } from "./Lightbox";
import { ListingEditor, overLimit } from "./MetadataInspector";
import { LOCALE_MAP } from "@/lib/locales";
import type { UploadedScreenshot } from "@/lib/image";
import { downloadPng, exportFastlaneZip, FEATURE_HEIGHT, FEATURE_WIDTH, POSTER_HEIGHT, POSTER_WIDTH, type ExportItem } from "@/lib/export";
import type { GenerateAsoResponse, LayoutStyle, LocaleCode, LocaleResult, PlayStoreMetadata, TextPosition } from "@/lib/types";

type View = "posters" | "feature" | "listing";
type Size = "s" | "m" | "l";

const VIEWS = [
  { value: "posters" as const, label: "Posters" },
  { value: "feature" as const, label: "Feature graphic" },
  { value: "listing" as const, label: "Listing text" },
];
const LAYOUTS = [
  { value: "classic" as const, label: "Classic" },
  { value: "tilt" as const, label: "Tilt" },
  { value: "offset" as const, label: "Offset" },
];
const POSITIONS = [
  { value: "top" as const, label: "Text top" },
  { value: "bottom" as const, label: "Text bottom" },
];
const SIZES = [
  { value: "s" as const, label: "S" },
  { value: "m" as const, label: "M" },
  { value: "l" as const, label: "L" },
];
const SIZE_PX: Record<Size, number> = { s: 240, m: 320, l: 440 };

interface Props {
  result: GenerateAsoResponse | null;
  screenshots: UploadedScreenshot[];
  loading: boolean;
  loadingLabel?: string;
  appName: string;
  layout: LayoutStyle;
  onLayoutChange: (l: LayoutStyle) => void;
  textPosition: TextPosition;
  onTextPositionChange: (p: TextPosition) => void;
  onMetadataChange: (locale: LocaleCode, field: keyof PlayStoreMetadata, value: string) => void;
  /** Landscape art per market from Muse Image; falls back to the poster background. */
  featureArt: Record<string, string>;
  featureLoading: boolean;
  featureLabel?: string;
  featureError: string | null;
  onGenerateFeatureArt: () => void;
  /** Lets other tabs (Store preview) trigger the same Fastlane export. */
  onRegisterExport?: (fn: (() => Promise<void>) | null) => void;
}

function featureProps(r: LocaleResult, appName: string, shots: UploadedScreenshot[], result: GenerateAsoResponse, art: Record<string, string>) {
  return {
    locale: r.locale,
    appName: appName || r.metadata.title.split(/[:\-–|]/)[0].trim(),
    headline: r.posters[0]?.headline || r.metadata.title,
    subheadline: r.metadata.shortDescription,
    screenshot: shots[0],
    segments: result.segments[0] ?? [],
    backgroundDataUrl: art[r.locale] ?? r.backgroundDataUrl,
  };
}

/**
 * Review and export area of step 2: one market at a time, with posters, the feature
 * graphic and the listing text each given the full width.
 */
export function PosterStudio({
  result,
  screenshots,
  loading,
  loadingLabel,
  appName,
  layout,
  onLayoutChange,
  textPosition,
  onTextPositionChange,
  onMetadataChange,
  featureArt,
  featureLoading,
  featureLabel,
  featureError,
  onGenerateFeatureArt,
  onRegisterExport,
}: Props) {
  const [view, setView] = useState<View>("posters");
  const [size, setSize] = useState<Size>("m");
  const [picked, setPicked] = useState<LocaleCode | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [exporting, setExporting] = useState<null | { done: number; total: number }>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [farm, setFarm] = useState(false);

  const visible = useRef(new Map<string, HTMLDivElement>());
  const farmNodes = useRef(new Map<string, HTMLDivElement>());

  const locale: LocaleCode | null = result?.locales.length
    ? picked && result.locales.some((r) => r.locale === picked)
      ? picked
      : result.locales[0].locale
    : null;
  const current = result?.locales.find((r) => r.locale === locale) ?? null;

  // Ref callbacks that record nodes by key; refs are only touched when React attaches a node.
  const keepVisible = useCallback(
    (key: string) => (el: HTMLDivElement | null) => {
      if (el) visible.current.set(key, el);
      else visible.current.delete(key);
    },
    [],
  );
  const keepFarm = useCallback(
    (key: string) => (el: HTMLDivElement | null) => {
      if (el) farmNodes.current.set(key, el);
      else farmNodes.current.delete(key);
    },
    [],
  );

  /* ------------------------------ export ------------------------------ */

  const handleExportAll = useCallback(async () => {
    if (!result) return;
    setExportError(null);
    setExporting({ done: 0, total: 0 });
    // Mount every poster and feature graphic at native size off screen, then render them.
    setFarm(true);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      const items: ExportItem[] = [];
      for (const r of result.locales) {
        screenshots.forEach((_, i) => {
          const node = farmNodes.current.get(`p-${r.locale}-${i}`);
          if (node) items.push({ kind: "poster", locale: r.locale, index: i, node });
        });
        const f = farmNodes.current.get(`f-${r.locale}`);
        if (f) items.push({ kind: "feature", locale: r.locale, node: f });
      }
      if (!items.length) throw new Error("Nothing was ready to render.");
      await exportFastlaneZip(result.locales, items, (done, total) => setExporting({ done, total }));
    } catch (err) {
      setExportError((err as Error).message);
    } finally {
      setFarm(false);
      setExporting(null);
    }
  }, [result, screenshots]);

  const exportRef = useRef(handleExportAll);
  useEffect(() => {
    exportRef.current = handleExportAll;
  });
  useEffect(() => {
    onRegisterExport?.(() => exportRef.current());
    return () => onRegisterExport?.(null);
  }, [onRegisterExport]);

  const savePng = async (key: string, item: ExportItem) => {
    setSaving(key);
    setExportError(null);
    try {
      await downloadPng(item);
    } catch (err) {
      setExportError((err as Error).message);
    } finally {
      setSaving(null);
    }
  };

  /* ------------------------------ review ------------------------------ */

  const lightboxItems: LightboxItem[] = useMemo(() => {
    if (!result || !current) return [];
    const label = LOCALE_MAP[current.locale].label;
    const posters: LightboxItem[] = screenshots.map((shot, i) => ({
      key: `p-${i}`,
      caption: `${label}, poster ${i + 1}`,
      width: POSTER_WIDTH,
      height: POSTER_HEIGHT,
      render: () => (
        <PosterCanvas
          locale={current.locale}
          screenshot={shot}
          segments={result.segments[i] ?? []}
          copy={current.posters[i] ?? current.posters[0] ?? { headline: "", subheadline: "" }}
          backgroundDataUrl={current.backgroundDataUrl}
          layout={layout}
          textPosition={textPosition}
        />
      ),
    }));
    const feature: LightboxItem = {
      key: "f",
      caption: `${label}, feature graphic`,
      width: FEATURE_WIDTH,
      height: FEATURE_HEIGHT,
      render: () => <FeatureGraphic {...featureProps(current, appName, screenshots, result, featureArt)} />,
    };
    return [...posters, feature];
  }, [result, current, screenshots, layout, textPosition, appName, featureArt]);

  /* ------------------------------ render ------------------------------ */

  const posterCount = result ? result.locales.length * screenshots.length : 0;

  return (
    <Card className="overflow-hidden lg:h-full">
      <CardHeader
        title="Review"
        description={
          result
            ? `${result.locales.length} market${result.locales.length === 1 ? "" : "s"}, ${posterCount} poster${posterCount === 1 ? "" : "s"} and ${result.locales.length} feature graphic${result.locales.length === 1 ? "" : "s"}.`
            : "Posters, the feature graphic and listing text for each market."
        }
        actions={
          <Button variant="primary" size="sm" disabled={!result || loading} loading={!!exporting} onClick={handleExportAll}>
            {exporting ? (exporting.total ? `Rendering ${exporting.done} of ${exporting.total}` : "Preparing") : "Download Fastlane ZIP"}
          </Button>
        }
      />

      {result && !loading && (
        <div className="space-y-3 px-5 pb-4">
          <SegmentedControl label="What to review" options={VIEWS} value={view} onChange={setView} className="max-w-full overflow-x-auto" />
          <Tabs
            label="Market"
            value={locale}
            onChange={setPicked}
            items={result.locales.map((r) => ({ value: r.locale, label: LOCALE_MAP[r.locale].label, flagged: overLimit(r) }))}
          />
        </div>
      )}

      {exportError && (
        <Notice tone="bad" title="The export stopped" className="mx-5 mb-4">
          {exportError} Try again, or save files one at a time.
        </Notice>
      )}

      <div className="min-h-[420px] flex-1 overflow-y-auto border-t border-line lg:min-h-0">
        {!result && !loading && (
          <EmptyState title="Nothing generated yet">
            Add screenshots and a short description, choose markets, then generate. Each market gets posters, a feature
            graphic and listing text to review here.
          </EmptyState>
        )}
        {loading && (
          <Working>
            {loadingLabel ? `${loadingLabel}. ` : ""}Each market gets its own copy and background, so larger selections take a little longer.
          </Working>
        )}

        {result && current && !loading && (
          <div className="space-y-6 px-5 py-6">
            {result.warnings.length > 0 && (
              <Notice tone="warn" title="Some model calls fell back to simulated output">
                <ul className="list-disc space-y-0.5 pl-4">
                  {result.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </Notice>
            )}


            {view === "posters" && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <SegmentedControl label="Poster layout" options={LAYOUTS} value={layout} onChange={onLayoutChange} />
                  <SegmentedControl label="Headline position" options={POSITIONS} value={textPosition} onChange={onTextPositionChange} />
                  <SegmentedControl label="Preview size" options={SIZES} value={size} onChange={setSize} className="ml-auto" />
                </div>
                <div className="grid-bg -mx-5 flex flex-wrap justify-center gap-x-8 gap-y-6 px-5 py-8">
                  {screenshots.map((shot, i) => {
                    const key = `p-${current.locale}-${i}`;
                    return (
                      <figure key={key} className="flex min-w-0 flex-col gap-2.5" style={{ width: SIZE_PX[size], maxWidth: "100%" }}>
                        <button
                          type="button"
                          onClick={() => setLightbox(i)}
                          className="block overflow-hidden rounded-[14px] shadow-pop transition-transform duration-150 hover:-translate-y-0.5"
                          aria-label={`Open poster ${i + 1} full size`}
                        >
                          <FitFrame width={POSTER_WIDTH} height={POSTER_HEIGHT}>
                            <PosterCanvas
                              ref={keepVisible(key)}
                              locale={current.locale}
                              screenshot={shot}
                              segments={result.segments[i] ?? []}
                              copy={current.posters[i] ?? current.posters[0] ?? { headline: "", subheadline: "" }}
                              backgroundDataUrl={current.backgroundDataUrl}
                              layout={layout}
                              textPosition={textPosition}
                            />
                          </FitFrame>
                        </button>
                        <figcaption className="flex items-center justify-between gap-2 px-0.5 text-xs">
                          <span className="text-muted">Poster {i + 1}</span>
                          <span className="flex gap-3">
                            <TextButton className="text-xs" onClick={() => setLightbox(i)}>
                              View
                            </TextButton>
                            <TextButton
                              className="text-xs"
                              disabled={saving === key}
                              onClick={() => {
                                const node = visible.current.get(key);
                                if (node) void savePng(key, { kind: "poster", locale: current.locale, index: i, node });
                              }}
                            >
                              {saving === key ? "Saving" : "Save PNG"}
                            </TextButton>
                          </span>
                        </figcaption>
                      </figure>
                    );
                  })}
                </div>
              </>
            )}

            {view === "feature" && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="max-w-xl text-[13px] leading-relaxed text-muted">
                    The 1024 by 500 banner Google Play shows above your screenshots.{" "}
                    {Object.keys(featureArt).length
                      ? "Using wide art generated for each market."
                      : "It uses the poster background until you generate wide art."}
                  </p>
                  <Button size="sm" loading={featureLoading} onClick={onGenerateFeatureArt}>
                    {featureLoading ? (featureLabel ?? "Generating art") : Object.keys(featureArt).length ? "Regenerate wide art" : "Generate wide art"}
                  </Button>
                </div>
                {featureError && (
                  <Notice tone="bad" title="Wide art could not be generated">
                    {featureError}
                  </Notice>
                )}
                {(() => {
                  const key = `f-${current.locale}`;
                  return (
                    <figure className="mx-auto flex max-w-4xl flex-col gap-2.5">
                      <button
                        type="button"
                        onClick={() => setLightbox(screenshots.length)}
                        className="block overflow-hidden rounded-xl shadow-pop"
                        aria-label="Open the feature graphic full size"
                      >
                        <FitFrame width={FEATURE_WIDTH} height={FEATURE_HEIGHT}>
                          <FeatureGraphic ref={keepVisible(key)} {...featureProps(current, appName, screenshots, result, featureArt)} />
                        </FitFrame>
                      </button>
                      <figcaption className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-muted">1024 by 500, featureGraphic.png</span>
                        <TextButton
                          className="text-xs"
                          disabled={saving === key}
                          onClick={() => {
                            const node = visible.current.get(key);
                            if (node) void savePng(key, { kind: "feature", locale: current.locale, node });
                          }}
                        >
                          {saving === key ? "Saving" : "Save PNG"}
                        </TextButton>
                      </figcaption>
                    </figure>
                  );
                })()}
              </div>
            )}

            {view === "listing" && <ListingEditor result={current} onMetadataChange={onMetadataChange} />}

            {current.culturalNote && view !== "listing" && (
              <p className="max-w-2xl text-[13px] leading-relaxed text-muted">
                <span className="font-medium text-ink">Why it reads this way in {LOCALE_MAP[current.locale].label}. </span>
                {current.culturalNote}
                {LOCALE_MAP[current.locale].rtl && <Tag className="ml-2">Right to left</Tag>}
              </p>
            )}
          </div>
        )}
      </div>

      {lightbox !== null && (
        <Lightbox items={lightboxItems} index={Math.min(lightbox, lightboxItems.length - 1)} onIndexChange={setLightbox} onClose={() => setLightbox(null)} />
      )}

      {farm &&
        result &&
        createPortal(
          <div aria-hidden style={{ position: "fixed", left: -20000, top: 0, pointerEvents: "none" }}>
            {result.locales.map((r) => (
              <div key={r.locale}>
                {screenshots.map((shot, i) => (
                  <PosterCanvas
                    key={i}
                    ref={keepFarm(`p-${r.locale}-${i}`)}
                    locale={r.locale}
                    screenshot={shot}
                    segments={result.segments[i] ?? []}
                    copy={r.posters[i] ?? r.posters[0] ?? { headline: "", subheadline: "" }}
                    backgroundDataUrl={r.backgroundDataUrl}
                    layout={layout}
                    textPosition={textPosition}
                  />
                ))}
                <FeatureGraphic ref={keepFarm(`f-${r.locale}`)} {...featureProps(r, appName, screenshots, result, featureArt)} />
              </div>
            ))}
          </div>,
          document.body,
        )}
    </Card>
  );
}
