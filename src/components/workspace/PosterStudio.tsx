"use client";

import { useCallback, useRef, useState } from "react";
import {
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Download,
  ImageIcon,
  LayoutTemplate,
  Loader2,
  Package,
  RotateCw,
  SquareStack,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { PosterCanvas } from "./PosterCanvas";
import { LOCALE_MAP } from "@/lib/locales";
import type { UploadedScreenshot } from "@/lib/image";
import { downloadPosterPng, exportFastlaneZip, type PosterNodeRef } from "@/lib/export";
import type { GenerateAsoResponse, LayoutStyle, TextPosition } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  result: GenerateAsoResponse | null;
  screenshots: UploadedScreenshot[];
  loading: boolean;
  layout: LayoutStyle;
  onLayoutChange: (l: LayoutStyle) => void;
  textPosition: TextPosition;
  onTextPositionChange: (p: TextPosition) => void;
}

const LAYOUTS: { id: LayoutStyle; label: string; icon: React.ReactNode }[] = [
  { id: "classic", label: "Classic", icon: <LayoutTemplate size={14} /> },
  { id: "tilt", label: "Tilt", icon: <RotateCw size={14} /> },
  { id: "offset", label: "Offset", icon: <SquareStack size={14} /> },
];

export function PosterStudio({
  result,
  screenshots,
  loading,
  layout,
  onLayoutChange,
  textPosition,
  onTextPositionChange,
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
    <Panel className="h-full">
      <PanelHeader
        icon={<ImageIcon size={16} />}
        title="Visual ASO Poster Studio"
        subtitle="9:16 posters · exported at 1080×1920"
        right={
          result && (
            <Badge tone="accent">
              {posterCount} poster{posterCount === 1 ? "" : "s"}
            </Badge>
          )
        }
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-panel-border px-4 py-2.5">
        <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1">
          {LAYOUTS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => onLayoutChange(l.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors",
                layout === l.id ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-white",
              )}
            >
              {l.icon}
              {l.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1">
          <button
            type="button"
            onClick={() => onTextPositionChange("top")}
            title="Text on top"
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs",
              textPosition === "top" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-white",
            )}
          >
            <AlignVerticalJustifyStart size={14} /> Top
          </button>
          <button
            type="button"
            onClick={() => onTextPositionChange("bottom")}
            title="Text on bottom"
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs",
              textPosition === "bottom" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-white",
            )}
          >
            <AlignVerticalJustifyEnd size={14} /> Bottom
          </button>
        </div>
        <div className="ml-auto">
          <Button variant="primary" size="sm" disabled={!result || !!exporting || loading} onClick={handleExportAll}>
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />}
            {exporting ? `Rendering ${exporting.done}/${exporting.total}…` : "Download Fastlane ZIP"}
          </Button>
        </div>
      </div>
      {exportError && <p className="border-b border-rose-900/40 bg-rose-950/30 px-4 py-2 text-xs text-rose-300">{exportError}</p>}

      <PanelBody className="grid-bg">
        {!result && !loading && (
          <EmptyState
            title="No posters yet"
            body="Upload screenshots, describe the app, pick target markets and hit Generate. Posters for every locale will appear here."
          />
        )}
        {loading && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-zinc-400">
            <Loader2 size={28} className="animate-spin text-violet-400" />
            <p>Segmenting UI with SAM 3.1, writing copy with Muse Spark, painting backgrounds with Muse Image…</p>
          </div>
        )}
        {result && !loading && (
          <div className="space-y-8">
            {result.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                <p className="mb-1 font-semibold">Some model calls fell back to simulation:</p>
                <ul className="list-disc space-y-0.5 pl-4">
                  {result.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.locales.map((r) => {
              const loc = LOCALE_MAP[r.locale];
              return (
                <section key={r.locale}>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-xl leading-none">{loc.flag}</span>
                    <h3 className="text-sm font-semibold">{loc.label}</h3>
                    {loc.rtl && <Badge tone="accent">RTL</Badge>}
                    <span className="text-[11px] text-muted">· {r.culturalNote}</span>
                  </div>
                  <div className="flex gap-5 overflow-x-auto pb-3">
                    {screenshots.map((shot, i) => {
                      const key = `${r.locale}-${i}`;
                      const copy = r.posters[i] ?? r.posters[0] ?? { headline: "", subheadline: "" };
                      return (
                        <div key={key} className="flex flex-col items-center gap-2">
                          <div className="rounded-[20px] p-[2px] ring-1 ring-white/10 shadow-2xl shadow-black/50">
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
                          <div className="flex w-full items-center justify-between px-1">
                            <span className="font-mono text-[10px] text-muted">
                              {loc.playStoreCode}/images/phoneScreenshots/{i + 1}.png
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={downloading === key}
                              onClick={() => {
                                const node = nodes.current.get(key);
                                if (node) void handleDownloadOne({ locale: r.locale, index: i, node });
                              }}
                            >
                              {downloading === key ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <Download size={13} />
                              )}
                              PNG
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-24 w-14 items-center justify-center rounded-2xl border-2 border-dashed border-zinc-700">
        <ImageIcon size={18} className="text-zinc-600" />
      </div>
      <p className="text-sm font-medium text-zinc-300">{title}</p>
      <p className="mt-1 max-w-xs text-xs text-muted">{body}</p>
    </div>
  );
}
