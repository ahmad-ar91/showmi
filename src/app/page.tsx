"use client";

import { useCallback, useEffect, useState } from "react";
import { Globe2, Rocket } from "lucide-react";
import { InputPanel } from "@/components/workspace/InputPanel";
import { PosterStudio } from "@/components/workspace/PosterStudio";
import { MetadataInspector } from "@/components/workspace/MetadataInspector";
import { MAX_BADGES_PER_SHOT, type ShotSegmentation } from "@/components/workspace/SegmentPicker";
import { Badge } from "@/components/ui/badge";
import type { UploadedScreenshot } from "@/lib/image";
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

export default function WorkspacePage() {
  const [screenshots, setScreenshots] = useState<UploadedScreenshot[]>([]);
  const [segmentation, setSegmentation] = useState<Record<string, ShotSegmentation>>({});
  const [appName, setAppName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedLocales, setSelectedLocales] = useState<LocaleCode[]>(["en-US", "ja-JP", "id-ID"]);

  const [result, setResult] = useState<GenerateAsoResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"mock" | "live" | "unknown">("unknown");

  const [layout, setLayout] = useState<LayoutStyle>("classic");
  const [textPosition, setTextPosition] = useState<TextPosition>("top");

  // Ask the API which mode it is running in (mock vs live) for the status badge.
  useEffect(() => {
    fetch("/api/generate-aso")
      .then((r) => r.json())
      .then((d: { mode?: "mock" | "live" }) => setMode(d.mode ?? "unknown"))
      .catch(() => setMode("unknown"));
  }, []);

  const toggleLocale = useCallback((code: LocaleCode) => {
    setSelectedLocales((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }, []);

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
      };
      const res = await fetch("/api/generate-aso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as GenerateAsoResponse | { error: string };
      if (!res.ok || "error" in data) throw new Error("error" in data ? data.error : `HTTP ${res.status}`);
      setResult(data);
      setMode(data.mode);
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

  /** Runs SAM 3.1 for a freshly uploaded screenshot and pre-selects the two strongest regions. */
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

  /** Segments the user picked, in screenshot order, for the generate request + poster. */
  const pickedSegments = (): Segment[][] =>
    screenshots.map((shot) => {
      const st = segmentation[shot.id];
      if (!st || st.status !== "ready") return [];
      return st.segments.filter((s) => st.selected.includes(s.id));
    });

  return (
    <main className="flex h-screen flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-panel-border bg-panel/80 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 shadow-lg shadow-violet-900/40">
            <Rocket size={18} />
          </span>
          <div>
            <h1 className="text-base font-semibold leading-tight">LocaLaunch AI</h1>
            <p className="text-[11px] text-muted">Multimodal ASO Localization Agent · SAM 3.1 + Muse Spark + Muse Image</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {error && <Badge tone="danger">{error}</Badge>}
          {result && (
            <Badge tone="neutral">
              <Globe2 size={11} /> {result.locales.length} locale{result.locales.length === 1 ? "" : "s"} · generated{" "}
              {new Date(result.generatedAt).toLocaleTimeString()}
            </Badge>
          )}
          <Badge tone="accent">Meta Hackathon</Badge>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[320px_minmax(0,1fr)_360px] lg:overflow-hidden xl:grid-cols-[340px_minmax(0,1fr)_400px]">
        <div className="min-h-[520px] lg:min-h-0">
          <InputPanel
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
          />
        </div>
        <div className="min-h-[720px] lg:min-h-0">
          <PosterStudio
            result={result}
            screenshots={screenshots}
            loading={loading}
            layout={layout}
            onLayoutChange={setLayout}
            textPosition={textPosition}
            onTextPositionChange={setTextPosition}
          />
        </div>
        <div className="min-h-[520px] lg:min-h-0">
          <MetadataInspector results={result?.locales ?? null} onMetadataChange={handleMetadataChange} />
        </div>
      </div>
    </main>
  );
}
