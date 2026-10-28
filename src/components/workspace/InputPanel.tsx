"use client";

import { useCallback, useRef, useState } from "react";
import { Loader2, Search, Settings2, Sparkles, Trash2, Upload, X } from "lucide-react";
import { SegmentPicker, type ShotSegmentation } from "./SegmentPicker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { LOCALE_MAP, LOCALE_REGIONS, LOCALES, localeSearchText } from "@/lib/locales";
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
  const [marketQuery, setMarketQuery] = useState("");
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
        title="Brief"
        subtitle="Screenshots, a short description and the markets you want"
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
            <label className="text-xs font-semibold text-muted">
              Screenshots
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
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors",
              dragOver ? "border-accent bg-accent-soft" : "border-line bg-sunken hover:border-line-strong",
              screenshots.length >= MAX_SCREENSHOTS && "pointer-events-none opacity-50",
            )}
          >
            <Upload size={20} className="text-accent-ink" />
            <p className="text-sm">
              Drop PNG or JPG here, or <span className="text-accent underline">browse</span>
            </p>
            <p className="text-[11px] text-muted">One to three portrait screenshots</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void loadSample();
              }}
              className="mt-1 text-[11px] text-accent underline-offset-2 hover:underline"
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
          {uploadError && <p className="mt-2 text-[11px] text-bad">{uploadError}</p>}

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
          <label className="block text-xs font-semibold text-muted">About the app</label>
          <input
            value={appName}
            onChange={(e) => onAppNameChange(e.target.value.slice(0, 20))}
            placeholder="App name (optional, e.g. Ritmova)"
            className="h-10 w-full rounded-lg border border-line bg-sunken px-3 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <div>
            <textarea
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value.slice(0, MAX_DESCRIPTION))}
              rows={5}
              placeholder="Describe the app in one or two sentences: what it does, who it is for, the main benefit."
              className="w-full resize-none rounded-lg border border-line bg-sunken px-3 py-2 text-sm leading-relaxed placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <div className="mt-1 text-right text-[11px] text-muted">
              {description.length}/{MAX_DESCRIPTION}
            </div>
          </div>
        </div>

        {/* Markets */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="market-search" className="text-xs font-semibold text-muted">
              Markets
            </label>
            <span className="text-[11px] text-muted">
              {selectedLocales.length} of {LOCALES.length} selected
              {selectedLocales.length > 0 && (
                <button
                  type="button"
                  onClick={() => selectedLocales.forEach((c) => onToggleLocale(c))}
                  className="ml-2 text-accent hover:underline"
                >
                  Clear
                </button>
              )}
            </span>
          </div>

          {selectedLocales.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Selected markets">
              {selectedLocales.map((code) => {
                const l = LOCALE_MAP[code];
                if (!l) return null;
                return (
                  <li key={code}>
                    <button
                      type="button"
                      onClick={() => onToggleLocale(code)}
                      title={`Remove ${l.label}`}
                      className="flex items-center gap-1 rounded-sm border border-accent/30 bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent-ink hover:border-accent"
                    >
                      <span>{l.flag}</span>
                      {l.label}
                      <X size={10} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="relative mb-2">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
            <input
              id="market-search"
              value={marketQuery}
              onChange={(e) => setMarketQuery(e.target.value)}
              placeholder="Search language, country or code"
              className="h-9 w-full rounded-md border border-line bg-panel pl-8 pr-3 text-sm placeholder:text-faint focus:border-accent focus:outline-none"
            />
          </div>

          <div className="max-h-72 overflow-y-auto rounded-md border border-line">
            {LOCALE_REGIONS.map((region) => {
              const q = marketQuery.trim().toLowerCase();
              const rows = LOCALES.filter((l) => l.region === region && (!q || localeSearchText(l).includes(q)));
              if (!rows.length) return null;
              return (
                <div key={region}>
                  <p className="sticky top-0 z-10 border-b border-line bg-sunken px-3 py-1 text-[11px] font-medium text-muted">
                    {region}
                  </p>
                  <ul>
                    {rows.map((l) => {
                      const checked = selectedLocales.includes(l.code);
                      return (
                        <li key={l.code}>
                          <label
                            className={cn(
                              "flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm transition-colors",
                              checked ? "bg-accent-soft" : "hover:bg-sunken",
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => onToggleLocale(l.code)}
                              className="h-3.5 w-3.5 accent-accent"
                            />
                            <span className="leading-none">{l.flag}</span>
                            <span className="min-w-0 flex-1 truncate">
                              {l.label}
                              <span className="ml-2 text-[11px] text-muted" dir={l.rtl ? "rtl" : "ltr"}>
                                {l.nativeLabel}
                              </span>
                            </span>
                            {l.rtl && <Badge tone="neutral">RTL</Badge>}
                            <span className="font-mono text-[10px] text-faint">{l.playStoreCode}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
            {LOCALES.every((l) => !localeSearchText(l).includes(marketQuery.trim().toLowerCase())) && (
              <p className="px-3 py-4 text-center text-xs text-muted">No market matches “{marketQuery}”.</p>
            )}
          </div>
          {selectedLocales.length > 8 && (
            <p className="mt-1.5 text-[11px] text-muted">
              Each market adds one copy and one background request, so large selections take longer.
            </p>
          )}
        </div>

        <div className="space-y-2 pt-2">
          <Button variant="primary" size="lg" className="w-full" disabled={!canGenerate} onClick={onGenerate}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            {loading ? "Generating…" : "Generate localized listing"}
          </Button>
          {screenshots.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted"
              onClick={() => onScreenshotsChange([])}
              disabled={loading}
            >
              <Trash2 size={14} /> Clear screenshots
            </Button>
          )}
          <p className="text-center text-[11px] text-muted">
            Runs SAM 3.1 for badges, Muse Spark for copy and Muse Image for backgrounds.
          </p>
        </div>
      </PanelBody>
    </Panel>
  );
}
