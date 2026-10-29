"use client";

import { useCallback, useRef, useState } from "react";
import { SegmentPicker, type ShotSegmentation } from "./SegmentPicker";
import { Button, Card, CardBody, CardHeader, CheckRow, Divider, Field, Input, Tag, Textarea, TextButton } from "@/components/ui";
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
  loadingLabel?: string;
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
  loadingLabel,
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
        setUploadError("That file type is not supported. Use PNG, JPG or WEBP.");
        return;
      }
      const room = MAX_SCREENSHOTS - screenshots.length;
      if (room <= 0) {
        setUploadError(`You already have ${MAX_SCREENSHOTS} screenshots. Remove one to add another.`);
        return;
      }
      try {
        const converted = await Promise.all(accepted.slice(0, room).map(fileToScreenshot));
        onScreenshotsChange([...screenshots, ...converted]);
        if (accepted.length > room) setUploadError(`Added the first ${room}. The limit is ${MAX_SCREENSHOTS} screenshots.`);
      } catch (err) {
        setUploadError((err as Error).message);
      }
    },
    [screenshots, onScreenshotsChange],
  );

  const loadSample = async () => {
    try {
      const res = await fetch("/samples/ritmova-home.jpg");
      const blob = await res.blob();
      await addFiles([new File([blob], "ritmova-home.jpg", { type: "image/jpeg" })]);
    } catch (err) {
      setUploadError((err as Error).message);
    }
  };

  const q = marketQuery.trim().toLowerCase();
  const matches = LOCALES.filter((l) => !q || localeSearchText(l).includes(q));
  const missing = [
    !screenshots.length && "a screenshot",
    !description.trim() && "a description",
    !selectedLocales.length && "a market",
  ].filter(Boolean) as string[];
  const missingText =
    missing.length > 1 ? `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]}` : missing[0];
  const full = screenshots.length >= MAX_SCREENSHOTS;

  return (
    <Card className="lg:h-full">
      <CardHeader title="Brief" description="What the posters and listing text are built from." />
      <CardBody scroll className="space-y-6">
        {/* Screenshots */}
        <Field
          label="Screenshots"
          aside={`${screenshots.length} of ${MAX_SCREENSHOTS}`}
          error={uploadError ?? undefined}
          hint={!full ? "Portrait app screenshots work best." : undefined}
        >
          {!full && (
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
                "cursor-pointer rounded-lg border border-dashed px-4 py-5 text-center transition-colors",
                dragOver ? "border-accent bg-accent-soft/60" : "border-line-strong hover:border-ink/40 hover:bg-sunken",
              )}
            >
              <p className="text-sm text-ink">
                Drop images here or <span className="font-medium text-accent">choose files</span>
              </p>
              <p className="mt-1 text-xs text-muted">
                No screenshots handy?{" "}
                <TextButton
                  className="text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    void loadSample();
                  }}
                >
                  Use the sample
                </TextButton>
              </p>
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
          )}
        </Field>

        {screenshots.length > 0 && (
          <div className="-mt-3 space-y-3">
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

        <Divider />

        <Field label="App name" htmlFor="app-name" aside="Optional">
          <Input
            id="app-name"
            value={appName}
            onChange={(e) => onAppNameChange(e.target.value.slice(0, 20))}
            placeholder="Ritmova"
          />
        </Field>

        <Field label="What the app does" htmlFor="app-description" aside={`${description.length}/${MAX_DESCRIPTION}`}>
          <Textarea
            id="app-description"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value.slice(0, MAX_DESCRIPTION))}
            rows={4}
            placeholder="One or two sentences: what it does, who it is for, the main benefit."
          />
        </Field>

        <Divider />

        {/* Markets */}
        <Field
          label="Markets"
          htmlFor="market-search"
          aside={
            selectedLocales.length > 0 ? (
              <>
                {selectedLocales.length} selected{" "}
                <TextButton className="ml-1.5 text-xs" onClick={() => selectedLocales.forEach((c) => onToggleLocale(c))}>
                  Clear
                </TextButton>
              </>
            ) : (
              `${LOCALES.length} available`
            )
          }
          hint={
            selectedLocales.length > 8
              ? "Each market adds one copy and one background request, so large selections take longer."
              : undefined
          }
        >
          {selectedLocales.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pb-1" aria-label="Selected markets">
              {selectedLocales.map((code) => {
                const l = LOCALE_MAP[code];
                return l ? (
                  <Tag key={code} tone="accent" onRemove={() => onToggleLocale(code)}>
                    {l.label}
                  </Tag>
                ) : null;
              })}
            </div>
          )}
          <Input
            id="market-search"
            value={marketQuery}
            onChange={(e) => setMarketQuery(e.target.value)}
            placeholder="Search language, country or code"
            className="h-9"
          />
          <div className="max-h-72 overflow-y-auto rounded-lg border border-line">
            {LOCALE_REGIONS.map((region) => {
              const rows = matches.filter((l) => l.region === region);
              if (!rows.length) return null;
              return (
                <div key={region} className="pb-1">
                  <p className="sticky top-0 z-10 bg-panel/95 px-3 pb-1 pt-2.5 text-xs font-medium text-muted backdrop-blur-sm">
                    {region}
                  </p>
                  {rows.map((l) => (
                    <CheckRow
                      key={l.code}
                      checked={selectedLocales.includes(l.code)}
                      onChange={() => onToggleLocale(l.code)}
                      className="mx-1 py-1.5"
                      aside={<span className="font-mono text-[11px] text-faint">{l.playStoreCode}</span>}
                    >
                      <span className="flex min-w-0 items-baseline gap-2">
                        <span className="truncate">{l.label}</span>
                        <span className="truncate text-xs text-muted" dir={l.rtl ? "rtl" : "ltr"}>
                          {l.nativeLabel}
                        </span>
                      </span>
                    </CheckRow>
                  ))}
                </div>
              );
            })}
            {!matches.length && <p className="px-3 py-6 text-center text-[13px] text-muted">No market matches “{marketQuery}”.</p>}
          </div>
        </Field>
      </CardBody>

      <div className="border-t border-line px-5 py-4">
        <Button variant="primary" size="lg" block loading={loading} disabled={missing.length > 0} onClick={onGenerate}>
          {loading ? (loadingLabel ?? "Generating") : "Generate listing"}
        </Button>
        <p className="mt-2 text-center text-xs text-muted">
          {missing.length ? `Add ${missingText} to continue.` : `${selectedLocales.length} market${selectedLocales.length === 1 ? "" : "s"}, ${screenshots.length} poster${screenshots.length === 1 ? "" : "s"} each.`}
        </p>
      </div>
    </Card>
  );
}
