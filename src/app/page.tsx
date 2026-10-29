"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AsoAnalytics } from "@/components/AsoAnalytics";
import { BrandLockup, BrandMark } from "@/components/brand-mark";
import { TextButton } from "@/components/ui";
import { BRAND } from "@/lib/brand";
import { LocalizationStudio, type StudioHandoff } from "@/components/LocalizationStudio";
import { StoreSimulator } from "@/components/StoreSimulator";
import { MAX_BADGES_PER_SHOT, type ShotSegmentation } from "@/components/workspace/SegmentPicker";
import type { AsoAnalysis } from "@/lib/aso-analytics";
import { loadImage, type UploadedScreenshot } from "@/lib/image";
import type {
  GenerateAsoRequest,
  GenerateAsoResponse,
  LayoutStyle,
  LocaleCode,
  PlayStoreMetadata,
  Segment,
  SegmentRequest,
  SegmentResponse,
  TextPosition,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { inBatches, postJson } from "@/lib/client-api";

type Tab = "analytics" | "studio" | "simulator";

const TABS: { id: Tab; label: string; short: string; hint: string; step: string }[] = [
  { id: "analytics", label: "Audit the listing", short: "Audit", hint: "Score it and find gaps", step: "1" },
  { id: "studio", label: "Localize and fix", short: "Localize", hint: "Copy, posters, badges", step: "2" },
  { id: "simulator", label: "Preview and export", short: "Export", hint: "Store preview and ZIP", step: "3" },
];

/* Sidebar collapse is a per-browser preference, kept in localStorage when available. */
const RAIL_KEY = "showmi.sidebar.collapsed";
const railListeners = new Set<() => void>();
let memoryRail: boolean | null = null;
function readRail(): boolean {
  if (memoryRail !== null) return memoryRail;
  try {
    return window.localStorage.getItem(RAIL_KEY) === "1";
  } catch {
    return false;
  }
}
function writeRail(collapsed: boolean) {
  memoryRail = collapsed;
  try {
    window.localStorage.setItem(RAIL_KEY, collapsed ? "1" : "0");
  } catch {
    /* storage blocked: the toggle still works for this page view */
  }
  railListeners.forEach((l) => l());
}
function useRailCollapsed(): [boolean, (v: boolean) => void] {
  const value = useSyncExternalStore(
    (cb) => {
      railListeners.add(cb);
      return () => {
        railListeners.delete(cb);
      };
    },
    readRail,
    () => false,
  );
  return [value, writeRail];
}

interface ProviderStatus {
  mode?: "mock" | "live";
  text?: { name: string; model: string };
  image?: { name: string; model: string };
  segment?: { name: string; model: string };
}

export default function WorkspacePage() {
  const [tab, setTab] = useState<Tab>("analytics");

  /* ----------------------------- Tab 1 state ----------------------------- */
  const [analysis, setAnalysis] = useState<AsoAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [handoff, setHandoff] = useState<StudioHandoff | null>(null);

  /* ----------------------------- Tab 2 state ----------------------------- */
  const [screenshots, setScreenshots] = useState<UploadedScreenshot[]>([]);
  const [segmentation, setSegmentation] = useState<Record<string, ShotSegmentation>>({});
  const [appName, setAppName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedLocales, setSelectedLocales] = useState<LocaleCode[]>(["en-US", "ja-JP", "id-ID"]);
  const [result, setResult] = useState<GenerateAsoResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ProviderStatus>({});
  const [layout, setLayout] = useState<LayoutStyle>("classic");
  const [textPosition, setTextPosition] = useState<TextPosition>("top");
  const [featureArt, setFeatureArt] = useState<Record<string, string>>({});
  const [featureLoading, setFeatureLoading] = useState(false);
  const [featureProgress, setFeatureProgress] = useState<{ done: number; total: number } | null>(null);
  const [featureError, setFeatureError] = useState<string | null>(null);
  const [railCollapsed, setRailCollapsed] = useRailCollapsed();

  /* ----------------------------- Tab 3 state ----------------------------- */
  const exportFn = useRef<(() => Promise<void>) | null>(null);
  const [exporting, setExporting] = useState(false);
  const registerExport = useCallback((fn: (() => Promise<void>) | null) => {
    exportFn.current = fn;
  }, []);

  // Ask the API which providers back each capability (for the status badges).
  useEffect(() => {
    fetch("/api/generate-aso")
      .then((r) => r.json())
      .then((d: ProviderStatus) => setStatus(d))
      .catch(() => setStatus({}));
  }, []);

  const mode: "mock" | "live" | "unknown" = status.mode ?? "unknown";

  /* ------------------------------- Tab 1 ------------------------------- */

  const handleAnalyze = async (input: { appId: string; competitorAppId: string; demo?: boolean }) => {
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      setAnalysis(await postJson<AsoAnalysis>("/api/analyze-aso", input));
    } catch (err) {
      setAnalysisError((err as Error).message);
    } finally {
      setAnalyzing(false);
    }
  };

  /** "Fix & Localize Weaknesses": carry keywords, weaknesses and the weakest screenshots into Tab 2. */
  const handleFixAndLocalize = async () => {
    if (!analysis) return;
    setHandoff({
      sourceApp: analysis.app.title,
      keywords: analysis.keywordGaps.map((g) => g.keyword),
      weaknesses: analysis.weaknesses,
      recommendations: analysis.recommendations,
    });
    setAppName(analysis.app.title.split(/[:\-–|]/)[0].trim().slice(0, 20));
    setDescription(`${analysis.app.summary}\n\n${analysis.app.description.slice(0, 900)}`.slice(0, 1500));

    // Pre-load the audited screenshots (weakest first) with their SAM detections already attached.
    const ordered = [...analysis.visual].sort(
      (a, b) => Number(analysis.weakScreenshots.includes(b.index)) - Number(analysis.weakScreenshots.includes(a.index)),
    );
    const shots: UploadedScreenshot[] = [];
    const seg: Record<string, ShotSegmentation> = {};
    for (const v of ordered.slice(0, 3)) {
      if (!v.screenshotDataUrl) continue;
      try {
        const img = await loadImage(v.screenshotDataUrl);
        const id = `audit-${analysis.app.appId}-${v.index}`;
        shots.push({
          id,
          name: `${analysis.app.appId}-screenshot-${v.index + 1}.png`,
          dataUrl: v.screenshotDataUrl,
          aspect: img.naturalWidth / img.naturalHeight,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
        const selected = [...v.segments]
          .sort((a, b) => b.score - a.score)
          .slice(0, 2)
          .map((s) => s.id);
        seg[id] = { status: "ready", segments: v.segments, selected, mode: analysis.mode };
      } catch {
        /* skip unreadable screenshot */
      }
    }
    setScreenshots(shots);
    setSegmentation(seg);
    setResult(null);
    setTab("studio");
  };

  /* ------------------------------- Tab 2 ------------------------------- */

  const toggleLocale = useCallback((code: LocaleCode) => {
    setSelectedLocales((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }, []);

  /** Segments the user picked, in screenshot order, for the generate request + poster. */
  const pickedSegments = (): Segment[][] =>
    screenshots.map((shot) => {
      const st = segmentation[shot.id];
      if (!st || st.status !== "ready") return [];
      return st.segments.filter((s) => st.selected.includes(s.id));
    });

  /**
   * One request per market keeps every response small and inside serverless time limits.
   * The first market runs alone so its UI regions can be reused by the rest.
   */
  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    const locales = [...selectedLocales];
    setProgress({ done: 0, total: locales.length });
    const base: Omit<GenerateAsoRequest, "locales"> = {
      appName: appName.trim() || undefined,
      description: description.trim(),
      screenshots: screenshots.map((s) => s.dataUrl),
      segments: pickedSegments(),
      keywords: handoff?.keywords,
      weaknesses: handoff?.weaknesses,
    };
    const warnings: string[] = [];
    const parts: (GenerateAsoResponse | null)[] = new Array(locales.length).fill(null);
    try {
      const first = await postJson<GenerateAsoResponse>("/api/generate-aso", { ...base, locales: [locales[0]] });
      parts[0] = first;
      setProgress({ done: 1, total: locales.length });
      // Reuse the regions from the first market (at most three badges per screenshot).
      const segments = first.segments.map((list) => list.slice(0, 3));
      await inBatches(
        locales.slice(1),
        3,
        async (locale, i) => {
          try {
            parts[i + 1] = await postJson<GenerateAsoResponse>("/api/generate-aso", { ...base, segments, locales: [locale] });
          } catch (err) {
            warnings.push(`${locale}: ${(err as Error).message}`);
          }
        },
        (done) => setProgress({ done: done + 1, total: locales.length }),
      );
      const ok = parts.filter((r): r is GenerateAsoResponse => r !== null);
      setResult({
        mode: ok.some((r) => r.mode === "live") ? "live" : "mock",
        segments: first.segments,
        locales: ok.flatMap((r) => r.locales),
        warnings: [...ok.flatMap((r) => r.warnings), ...warnings.map((w) => `Skipped ${w}`)],
        generatedAt: new Date().toISOString(),
      });
      setFeatureArt({});
      setFeatureError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const handleMetadataChange = (locale: LocaleCode, field: keyof PlayStoreMetadata, value: string) => {
    setResult((prev) =>
      prev
        ? {
            ...prev,
            locales: prev.locales.map((l) =>
              l.locale === locale ? { ...l, metadata: { ...l.metadata, [field]: value } } : l,
            ),
          }
        : prev,
    );
  };

  /** Runs the segmentation provider for a freshly uploaded screenshot and pre-selects the two strongest regions. */
  const detectSegments = async (shot: UploadedScreenshot, index: number) => {
    setSegmentation((prev) => ({ ...prev, [shot.id]: { status: "detecting", segments: [], selected: [] } }));
    try {
      const data = await postJson<SegmentResponse>("/api/segment", { screenshot: shot.dataUrl, index } satisfies SegmentRequest);
      const selected = [...data.segments]
        .sort((a, b) => b.score - a.score)
        .slice(0, 2)
        .map((s) => s.id);
      setSegmentation((prev) => ({
        ...prev,
        [shot.id]: { status: "ready", segments: data.segments, selected, mode: data.mode, error: data.warning },
      }));
    } catch (err) {
      setSegmentation((prev) => ({
        ...prev,
        [shot.id]: { status: "error", segments: [], selected: [], error: (err as Error).message },
      }));
    }
  };

  // Screenshots removed after generation would leave dangling segments; keep the result consistent.
  const handleScreenshotsChange = (next: UploadedScreenshot[]) => {
    setScreenshots(next);
    if (result && next.length !== screenshots.length) setResult(null);
    next.forEach((shot, i) => {
      if (!segmentation[shot.id]) void detectSegments(shot, i);
    });
  };

  const handleToggleSegment = (screenshotId: string, segmentId: string) => {
    setSegmentation((prev) => {
      const cur = prev[screenshotId];
      if (!cur) return prev;
      const on = cur.selected.includes(segmentId);
      if (!on && cur.selected.length >= MAX_BADGES_PER_SHOT) return prev;
      const selected = on ? cur.selected.filter((id) => id !== segmentId) : [...cur.selected, segmentId];
      return { ...prev, [screenshotId]: { ...cur, selected } };
    });
    // Picks are reflected live on already-generated posters.
    setResult((prev) => {
      if (!prev) return prev;
      const idx = screenshots.findIndex((s) => s.id === screenshotId);
      const cur = segmentation[screenshotId];
      if (idx < 0 || !cur) return prev;
      const on = cur.selected.includes(segmentId);
      if (!on && cur.selected.length >= MAX_BADGES_PER_SHOT) return prev;
      const selected = on ? cur.selected.filter((id) => id !== segmentId) : [...cur.selected, segmentId];
      const picked = cur.segments.filter((s) => selected.includes(s.id));
      const segments = prev.segments.map((list, i) => (i === idx ? picked : list));
      return { ...prev, segments };
    });
  };

  /** Wide Muse Image art for the feature graphic of every generated market, one request each. */
  const handleGenerateFeatureArt = async () => {
    if (!result) return;
    setFeatureLoading(true);
    setFeatureError(null);
    const locales = result.locales.map((l) => l.locale);
    const art: Record<string, string> = {};
    const problems: string[] = [];
    try {
      await inBatches(
        locales,
        3,
        async (locale) => {
          try {
            const data = await postJson<{ art: Record<string, string>; warnings: string[] }>("/api/feature-graphic", {
              locales: [locale],
              description: description.trim(),
            });
            Object.assign(art, data.art);
            problems.push(...data.warnings);
          } catch (err) {
            problems.push(`${locale}: ${(err as Error).message}`);
          }
        },
        (done, total) => setFeatureProgress({ done, total }),
      );
      setFeatureArt(art);
      if (problems.length) setFeatureError(problems.join(" "));
    } finally {
      setFeatureLoading(false);
      setFeatureProgress(null);
    }
  };

  /* ------------------------------- Tab 3 ------------------------------- */

  /** Exports render off screen, so the preview can export without switching tabs. */
  const handleExportFromSimulator = async () => {
    if (!exportFn.current) return;
    setExporting(true);
    try {
      await exportFn.current();
    } finally {
      setExporting(false);
    }
  };

  /* --------------------------------- UI --------------------------------- */

  const stepDone: Record<Tab, boolean> = { analytics: !!analysis, studio: !!result, simulator: false };
  const modeLabel = mode === "live" ? "Live models" : mode === "mock" ? "Simulated models" : "Checking models";
  const modeDot = mode === "live" ? "bg-ok" : mode === "mock" ? "bg-warn" : "bg-faint";

  const stepBadge = (t: (typeof TABS)[number], active: boolean) => (
    <span
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[11px] transition-colors",
        stepDone[t.id] ? "bg-ok text-white" : active ? "bg-ink text-paper" : "text-muted ring-1 ring-inset ring-line-strong",
      )}
    >
      {stepDone[t.id] ? "✓" : t.step}
    </span>
  );

  return (
    <main
      className={cn(
        "min-h-screen lg:grid lg:h-screen lg:overflow-hidden lg:transition-[grid-template-columns] lg:duration-200",
        railCollapsed ? "lg:grid-cols-[76px_minmax(0,1fr)]" : "lg:grid-cols-[256px_minmax(0,1fr)]",
      )}
    >
      <h1 className="sr-only">{BRAND.name}</h1>

      {/* Phone and tablet: compact header with the steps as tabs */}
      <header className="sticky top-0 z-30 border-b border-line bg-panel/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3">
          <BrandLockup size={30} />
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <span className={cn("h-2 w-2 rounded-full", modeDot)} />
            {mode === "live" ? "Live" : mode === "mock" ? "Simulated" : ""}
          </span>
        </div>
        <nav className="grid grid-cols-3 gap-1 px-2 pb-2" aria-label="Workflow steps">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[13px] transition-colors",
                  active ? "bg-sunken font-medium text-ink" : "text-muted",
                )}
              >
                {stepBadge(t, active)}
                <span className="truncate">{t.short}</span>
              </button>
            );
          })}
        </nav>
      </header>

      {/* Desktop: left rail, collapsible */}
      <aside className="hidden min-h-0 flex-col overflow-hidden border-r border-line bg-panel lg:flex">
        <div className={cn("pb-5 pt-6", railCollapsed ? "flex justify-center px-2" : "px-5")}>
          {railCollapsed ? (
            <button type="button" onClick={() => setRailCollapsed(false)} aria-label="Expand sidebar" title="Expand sidebar">
              <BrandMark size={34} />
            </button>
          ) : (
            <BrandLockup />
          )}
        </div>

        <nav className={cn("flex flex-col gap-0.5", railCollapsed ? "items-center px-2" : "px-3")} aria-label="Workflow steps">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={active ? "step" : undefined}
                title={railCollapsed ? t.label : undefined}
                className={cn(
                  "flex items-start gap-3 rounded-lg text-left transition-colors",
                  railCollapsed ? "justify-center p-2.5" : "w-full px-3 py-2.5",
                  active ? "bg-sunken text-ink" : "text-muted hover:bg-sunken/60 hover:text-ink",
                )}
              >
                <span className={railCollapsed ? "" : "mt-0.5"}>{stepBadge(t, active)}</span>
                {railCollapsed ? (
                  <span className="sr-only">{t.label}</span>
                ) : (
                  <span className="min-w-0">
                    <span className="block whitespace-nowrap text-sm font-medium">{t.label}</span>
                    <span className="block whitespace-nowrap text-xs text-muted">{t.hint}</span>
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className={cn("mt-auto space-y-2 border-t border-line py-4 text-xs", railCollapsed ? "px-2 text-center" : "px-5")}>
          {railCollapsed ? (
            <>
              <span className={cn("mx-auto block h-2 w-2 rounded-full", modeDot)} title={modeLabel} />
              <TextButton className="text-xs" onClick={() => setRailCollapsed(false)}>
                Expand
              </TextButton>
            </>
          ) : (
            <>
              <p className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", modeDot)} />
                <span className="text-ink">{modeLabel}</span>
              </p>
              {mode === "live" && (
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-[11px] text-muted">
                  <dt>text</dt>
                  <dd className="truncate">{status.text?.model}</dd>
                  <dt>image</dt>
                  <dd className="truncate">{status.image?.model}</dd>
                  <dt>segment</dt>
                  <dd className="truncate">{status.segment?.model}</dd>
                </dl>
              )}
              {result && (
                <p className="text-muted">
                  {result.locales.length} market{result.locales.length === 1 ? "" : "s"} ready to export
                </p>
              )}
              {error && <p className="text-bad">{error}</p>}
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-faint">Built for the Meta hackathon</span>
                <TextButton className="text-xs" onClick={() => setRailCollapsed(true)}>
                  Collapse
                </TextButton>
              </div>
            </>
          )}
        </div>
      </aside>

      <div className="p-3 sm:p-4 lg:min-h-0 lg:overflow-hidden lg:p-5">
        {error && <p className="mb-3 rounded-lg bg-bad-soft px-3 py-2 text-[13px] text-bad lg:hidden">{error}</p>}
        <div className={cn("lg:h-full lg:min-h-0", tab === "analytics" ? "tab-enter" : "hidden")}>
          <AsoAnalytics
            analysis={analysis}
            loading={analyzing}
            error={analysisError}
            onAnalyze={handleAnalyze}
            onFixAndLocalize={handleFixAndLocalize}
          />
        </div>
        <div className={cn("lg:h-full lg:min-h-0", tab === "studio" ? "tab-enter" : "hidden")}>
          <LocalizationStudio
            handoff={handoff}
            onClearHandoff={() => setHandoff(null)}
            screenshots={screenshots}
            onScreenshotsChange={handleScreenshotsChange}
            segmentation={segmentation}
            onToggleSegment={handleToggleSegment}
            appName={appName}
            onAppNameChange={setAppName}
            description={description}
            onDescriptionChange={setDescription}
            selectedLocales={selectedLocales}
            onToggleLocale={toggleLocale}
            onGenerate={handleGenerate}
            loading={loading}
            loadingLabel={progress ? `Writing ${progress.done} of ${progress.total} market${progress.total === 1 ? "" : "s"}` : undefined}
            mode={mode}
            result={result}
            layout={layout}
            onLayoutChange={setLayout}
            textPosition={textPosition}
            onTextPositionChange={setTextPosition}
            onMetadataChange={handleMetadataChange}
            featureArt={featureArt}
            featureLoading={featureLoading}
            featureLabel={featureProgress ? `Painting ${featureProgress.done} of ${featureProgress.total}` : undefined}
            featureError={featureError}
            onGenerateFeatureArt={handleGenerateFeatureArt}
            onRegisterExport={registerExport}
          />
        </div>
        <div className={cn("lg:h-full lg:min-h-0", tab === "simulator" ? "tab-enter" : "hidden")}>
          <StoreSimulator
            analysis={analysis}
            result={result}
            screenshots={screenshots}
            appName={appName}
            description={description}
            layout={layout}
            textPosition={textPosition}
            exporting={exporting}
            onExport={handleExportFromSimulator}
          />
        </div>
      </div>
    </main>
  );
}
