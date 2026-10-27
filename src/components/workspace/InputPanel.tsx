"use client";

import { useCallback, useRef, useState } from "react";
import { Loader2, Settings2, Sparkles, Trash2, Upload } from "lucide-react";
import { SegmentPicker, type ShotSegmentation } from "./SegmentPicker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { LOCALES } from "@/lib/locales";
import { fileToScreenshot, type UploadedScreenshot } from "@/lib/image";
import type { LocaleCode } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_SCREENSHOTS = 3;
const MAX_DESCRIPTION = 1500;

interface Props {
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
}

export function InputPanel({
  screenshots,
  onScreenshotsChange,
  segmentation,
  onToggleSegment,
  appName,
  onAppNameChange,
  description,
  onDescriptionChange,
  selectedLocales,
  onToggleLocale,
  onGenerate,
  loading,
  mode,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      setUploadError(null);
      const accepted = Array.from(files).filter((f) => /^image\/(png|jpe?g|webp)$/.test(f.type));
      if (!accepted.length) {
        setUploadError("Only PNG, JPG or WEBP files are accepted.");
        return;
      }
      const room = MAX_SCREENSHOTS - screenshots.length;
      if (room <= 0) {
        setUploadError(`Maximum ${MAX_SCREENSHOTS} screenshots.`);
        return;
      }
      try {
        const converted = await Promise.all(accepted.slice(0, room).map(fileToScreenshot));
        onScreenshotsChange([...screenshots, ...converted]);
        if (accepted.length > room) setUploadError(`Only the first ${room} file(s) were added (max ${MAX_SCREENSHOTS}).`);
      } catch (err) {
        setUploadError((err as Error).message);
      }
    },
    [screenshots, onScreenshotsChange],
  );

  const loadSample = async () => {
    try {
      const res = await fetch("/samples/ritmova-home.png");
      const blob = await res.blob();
      await addFiles([new File([blob], "ritmova-home.png", { type: "image/png" })]);
    } catch (err) {
      setUploadError((err as Error).message);
    }
  };

  const canGenerate = screenshots.length > 0 && description.trim().length > 0 && selectedLocales.length > 0 && !loading;

  return (
    <Panel className="h-full">
      <PanelHeader
        icon={<Settings2 size={16} />}
        title="Input & Configuration"
        subtitle="Raw screenshots, app brief, target markets"
        right={
          <Badge tone={mode === "live" ? "success" : mode === "mock" ? "warning" : "neutral"}>
            {mode === "live" ? "Live Meta API" : mode === "mock" ? "Simulation mode" : "Checking…"}
          </Badge>
        }
      />
      <PanelBody className="space-y-6">
        {/* Screenshots */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              1. App screenshots
            </label>
            <span className="text-[11px] text-muted">
              {screenshots.length}/{MAX_SCREENSHOTS}
            </span>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              void addFiles(e.dataTransfer.files);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center transition-colors",
              dragOver ? "border-violet-500 bg-violet-500/10" : "border-zinc-700 bg-zinc-900/60 hover:border-zinc-500",
              screenshots.length >= MAX_SCREENSHOTS && "pointer-events-none opacity-50",
            )}
          >
            <Upload size={20} className="text-violet-300" />
            <p className="text-sm">
              Drop PNG/JPG here or <span className="text-violet-300 underline">browse</span>
            </p>
            <p className="text-[11px] text-muted">1 – 3 raw mobile screenshots, portrait preferred</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void loadSample();
              }}
              className="mt-1 text-[11px] text-cyan-300 underline-offset-2 hover:underline"
            >
              or load the sample Ritmova screenshot
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) void addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
          {uploadError && <p className="mt-2 text-[11px] text-rose-300">{uploadError}</p>}

          {screenshots.length > 0 && (
            <div className="mt-3 space-y-3">
              {screenshots.map((s, i) => (
                <SegmentPicker
                  key={s.id}
                  screenshot={s}
                  index={i}
                  state={segmentation[s.id]}
                  onToggle={(segId) => onToggleSegment(s.id, segId)}
                  onRemove={() => onScreenshotsChange(screenshots.filter((x) => x.id !== s.id))}
                />
              ))}
            </div>
          )}
        </div>

        {/* App brief */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">2. App brief</label>
          <input
            value={appName}
            onChange={(e) => onAppNameChange(e.target.value.slice(0, 20))}
            placeholder="App name (optional, e.g. Ritmova)"
            className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none"
          />
          <div>
            <textarea
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value.slice(0, MAX_DESCRIPTION))}
              rows={5}
              placeholder="Describe the app in one or two sentences: what it does, who it is for, the main benefit."
              className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm leading-relaxed placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none"
            />
            <div className="mt-1 text-right text-[11px] text-muted">
              {description.length}/{MAX_DESCRIPTION}
            </div>
          </div>
        </div>

        {/* Locales */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">3. Target markets</label>
            <span className="text-[11px] text-muted">{selectedLocales.length} selected</span>
          </div>
          <ul className="space-y-1.5">
            {LOCALES.map((l) => {
              const checked = selectedLocales.includes(l.code);
              return (
                <li key={l.code}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
                      checked
                        ? "border-violet-500/60 bg-violet-500/10"
                        : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-600",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleLocale(l.code)}
                      className="h-4 w-4 accent-violet-500"
                    />
                    <span className="text-lg leading-none">{l.flag}</span>
                    <span className="flex-1 text-sm">
                      {l.label}
                      <span className="ml-2 text-[11px] text-muted" dir={l.rtl ? "rtl" : "ltr"}>
                        {l.nativeLabel}
                      </span>
                    </span>
                    {l.rtl && <Badge tone="accent">RTL</Badge>}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="space-y-2 pt-2">
          <Button variant="primary" size="lg" className="w-full" disabled={!canGenerate} onClick={onGenerate}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            {loading ? "Generating…" : "Generate Localized ASO"}
          </Button>
          {screenshots.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-zinc-400"
              onClick={() => onScreenshotsChange([])}
              disabled={loading}
            >
              <Trash2 size={14} /> Clear screenshots
            </Button>
          )}
          <p className="text-center text-[11px] text-muted">
            Pipeline: SAM 3.1 segmentation → Muse Spark copy → Muse Image backgrounds
          </p>
        </div>
      </PanelBody>
    </Panel>
  );
}
