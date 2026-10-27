"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BarChart3, Globe2, Languages, Rocket, Store } from "lucide-react";
import { AsoAnalytics } from "@/components/AsoAnalytics";
import { LocalizationStudio, type StudioHandoff } from "@/components/LocalizationStudio";
import { StoreSimulator } from "@/components/StoreSimulator";
import { MAX_BADGES_PER_SHOT, type ShotSegmentation } from "@/components/workspace/SegmentPicker";
import { Badge } from "@/components/ui/badge";
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

const TABS: { id: Tab; label: string; step: string; icon: React.ReactNode }[] = [
  { id: "analytics", label: "ASO Intelligence & Audit", step: "1", icon: <BarChart3 size={14} /> },
  { id: "studio", label: "Localization Studio", step: "2", icon: <Languages size={14} /> },
  { id: "simulator", label: "Store Simulator & Export", step: "3", icon: <Store size={14} /> },
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

  return (
    <main className="flex h-screen flex-col overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-panel-border bg-panel/80 px-5 py-2.5 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 shadow-lg shadow-violet-900/40">
            <Rocket size={18} />
          </span>
          <div>
            <h1 className="text-base font-semibold leading-tight">LocaLaunch AI</h1>
            <p className="text-[11px] text-muted">End-to-End ASO Analytics & Localization Agent</p>
          </div>
        </div>

        <nav className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                tab === t.id ? "bg-violet-600 text-white shadow" : "text-zinc-400 hover:text-white",
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full text-[10px]",
                  tab === t.id ? "bg-white/20" : "bg-zinc-800",
                )}
              >
                {t.step}
              </span>
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {error && <Badge tone="danger">{error}</Badge>}
          {result && (
            <Badge tone="neutral">
              <Globe2 size={11} /> {result.locales.length} locale{result.locales.length === 1 ? "" : "s"} generated
            </Badge>
          )}
          <Badge tone={mode === "live" ? "success" : mode === "mock" ? "warning" : "neutral"} title={`text ${status.text?.model ?? "?"} · image ${status.image?.model ?? "?"} · segment ${status.segment?.model ?? "?"}`}>
            {mode === "live"
              ? `Live · ${status.text?.name ?? ""}/${status.image?.name ?? ""}/${status.segment?.name ?? ""}`
              : mode === "mock"
                ? "Simulation mode"
                : "Checking…"}
          </Badge>
          <Badge tone="accent">Meta Hackathon</Badge>
        </div>
      </header>

      <div className="min-h-0 flex-1 p-4">
        <div className={cn("h-full min-h-0", tab !== "analytics" && "hidden")}>
          <AsoAnalytics
            analysis={analysis}
            loading={analyzing}
            error={analysisError}
            onAnalyze={handleAnalyze}
            onFixAndLocalize={handleFixAndLocalize}
          />
        </div>
        <div className={cn("h-full min-h-0", tab !== "studio" && "hidden")}>
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
        <div className={cn("h-full min-h-0", tab !== "simulator" && "hidden")}>
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
