"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Globe2, Rocket } from "lucide-react";
import { AsoAnalytics } from "@/components/AsoAnalytics";
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

type Tab = "analytics" | "studio" | "simulator";

const TABS: { id: Tab; label: string; hint: string; step: string }[] = [
  { id: "analytics", label: "Audit the listing", hint: "Score it, optionally vs a competitor", step: "1" },
  { id: "studio", label: "Localize and fix", hint: "Copy, posters, badges", step: "2" },
  { id: "simulator", label: "Preview and export", hint: "Store mock-up, Fastlane ZIP", step: "3" },
];

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
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ProviderStatus>({});
  const [layout, setLayout] = useState<LayoutStyle>("classic");
  const [textPosition, setTextPosition] = useState<TextPosition>("top");

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
      const res = await fetch("/api/analyze-aso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as AsoAnalysis | { error: string };
      if (!res.ok || "error" in data) throw new Error("error" in data ? data.error : `HTTP ${res.status}`);
      setAnalysis(data);
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

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const body: GenerateAsoRequest = {
        appName: appName.trim() || undefined,
        description: description.trim(),
        screenshots: screenshots.map((s) => s.dataUrl),
        locales: selectedLocales,
        segments: pickedSegments(),
        keywords: handoff?.keywords,
        weaknesses: handoff?.weaknesses,
      };
      const res = await fetch("/api/generate-aso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as GenerateAsoResponse | { error: string };
      if (!res.ok || "error" in data) throw new Error("error" in data ? data.error : `HTTP ${res.status}`);
      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
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
      const res = await fetch("/api/segment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screenshot: shot.dataUrl, index } satisfies SegmentRequest),
      });
      const data = (await res.json()) as SegmentResponse | { error: string };
      if (!res.ok || "error" in data) throw new Error("error" in data ? data.error : `HTTP ${res.status}`);
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

  /* ------------------------------- Tab 3 ------------------------------- */

  /** The poster DOM lives in Tab 2, so switch there, let it paint, then render + zip. */
  const handleExportFromSimulator = async () => {
    if (!exportFn.current) return;
    setExporting(true);
    setTab("studio");
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      await exportFn.current();
    } finally {
      setExporting(false);
    }
  };

  /* --------------------------------- UI --------------------------------- */

  const stepDone: Record<Tab, boolean> = { analytics: !!analysis, studio: !!result, simulator: false };

  return (
    <main className="grid h-screen grid-cols-1 overflow-hidden lg:grid-cols-[232px_minmax(0,1fr)]">
      {/* Left rail: brand, the three-step sequence, provider status */}
      <aside className="flex flex-col border-b border-line bg-panel lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3 px-5 pb-4 pt-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ink text-paper">
            <Rocket size={15} />
          </span>
          <div>
            <h1 className="font-display text-[22px] leading-none">LocaLaunch</h1>
            <p className="mt-1 text-xs text-muted">ASO audit, localization, export</p>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 lg:flex-col lg:gap-0.5" aria-label="Workflow steps">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex min-w-[180px] items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors lg:min-w-0",
                  active ? "bg-sunken text-ink" : "text-muted hover:bg-sunken/60 hover:text-ink",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-mono text-[11px]",
                    stepDone[t.id] ? "border-ok bg-ok text-panel" : active ? "border-ink text-ink" : "border-line-strong text-muted",
                  )}
                >
                  {stepDone[t.id] ? "✓" : t.step}
                </span>
                <span>
                  <span className="block text-sm font-medium">{t.label}</span>
                  <span className="block text-xs text-muted">{t.hint}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-5 py-3 text-xs lg:block lg:space-y-2 lg:py-4">
          <p className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", mode === "live" ? "bg-ok" : mode === "mock" ? "bg-warn" : "bg-faint")} />
            <span className="text-ink">
              {mode === "live" ? "Live models" : mode === "mock" ? "Simulated models" : "Checking models"}
            </span>
          </p>
          {mode === "live" && (
            <dl className="hidden grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-[11px] text-muted lg:grid">
              <dt>text</dt>
              <dd className="truncate">{status.text?.model}</dd>
              <dt>image</dt>
              <dd className="truncate">{status.image?.model}</dd>
              <dt>segment</dt>
              <dd className="truncate">{status.segment?.model}</dd>
            </dl>
          )}
          {result && (
            <p className="flex items-center gap-1.5 text-muted">
              <Globe2 size={11} /> {result.locales.length} locale{result.locales.length === 1 ? "" : "s"} ready to export
            </p>
          )}
          {error && <p className="text-bad">{error}</p>}
          <p className="pt-1 text-faint">Built for the Meta hackathon</p>
        </div>
      </aside>

      <div className="min-h-0 overflow-hidden p-4">
        <div className={cn("h-full min-h-0", tab === "analytics" ? "tab-enter" : "hidden")}>
          <AsoAnalytics
            analysis={analysis}
            loading={analyzing}
            error={analysisError}
            onAnalyze={handleAnalyze}
            onFixAndLocalize={handleFixAndLocalize}
          />
        </div>
        <div className={cn("h-full min-h-0", tab === "studio" ? "tab-enter" : "hidden")}>
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
            mode={mode}
            result={result}
            layout={layout}
            onLayoutChange={setLayout}
            textPosition={textPosition}
            onTextPositionChange={setTextPosition}
            onMetadataChange={handleMetadataChange}
            onRegisterExport={registerExport}
          />
        </div>
        <div className={cn("h-full min-h-0", tab === "simulator" ? "tab-enter" : "hidden")}>
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
