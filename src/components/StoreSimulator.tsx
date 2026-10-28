"use client";

import { useState } from "react";
import { Button, Card, CardHeader, EmptyState, Select, Tag } from "@/components/ui";
import { PosterCanvas } from "@/components/workspace/PosterCanvas";
import type { AsoAnalysis } from "@/lib/aso-analytics";
import { POSTER_HEIGHT, POSTER_WIDTH } from "@/lib/export";
import type { UploadedScreenshot } from "@/lib/image";
import { LOCALE_MAP } from "@/lib/locales";
import type { GenerateAsoResponse, LayoutStyle, LocaleCode, TextPosition } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  analysis: AsoAnalysis | null;
  result: GenerateAsoResponse | null;
  screenshots: UploadedScreenshot[];
  appName: string;
  description: string;
  layout: LayoutStyle;
  textPosition: TextPosition;
  exporting: boolean;
  onExport: () => void;
}

interface Listing {
  variant: "before" | "after" | "competitor";
  title: string;
  summary: string;
  rating: number;
  installs: string;
  icon?: string;
  developer: string;
  locale?: LocaleCode;
}

const VARIANT_LABEL = { before: "Now", after: "After", competitor: "Competitor" } as const;

/**
 * Step 3: a Google Play search-result mock-up comparing the listing before and after,
 * next to the competitor when there is one, plus the Fastlane export.
 */
export function StoreSimulator({ analysis, result, screenshots, appName, description, layout, textPosition, exporting, onExport }: Props) {
  const localeOptions = result?.locales.map((l) => l.locale) ?? [];
  const [localeChoice, setLocaleChoice] = useState<LocaleCode | null>(null);
  const locale = localeChoice && localeOptions.includes(localeChoice) ? localeChoice : (localeOptions[0] ?? null);
  const optimized = locale ? result?.locales.find((l) => l.locale === locale) : undefined;

  const before: Listing = analysis
    ? {
        variant: "before",
        title: analysis.app.title,
        summary: analysis.app.summary,
        rating: analysis.app.score,
        installs: analysis.app.installs,
        icon: analysis.app.icon,
        developer: analysis.app.developer,
      }
    : {
        variant: "before",
        title: appName || "Your app",
        summary: description.slice(0, 80) || "Current short description",
        rating: 4.3,
        installs: "",
        developer: "You",
      };

  const after: Listing | null = optimized
    ? {
        variant: "after",
        title: optimized.metadata.title,
        summary: optimized.metadata.shortDescription,
        rating: before.rating,
        installs: before.installs,
        icon: before.icon,
        developer: before.developer,
        locale: optimized.locale,
      }
    : null;

  const competitor: Listing | null = analysis?.competitor
    ? {
        variant: "competitor",
        title: analysis.competitor.title,
        summary: analysis.competitor.summary,
        rating: analysis.competitor.score,
        installs: analysis.competitor.installs,
        icon: analysis.competitor.icon,
        developer: analysis.competitor.developer,
      }
    : null;

  const query = analysis?.app.genre ? analysis.app.genre.toLowerCase() : appName || "your app";

  return (
    <div className="flex flex-col gap-4 lg:h-full lg:min-h-0">
      <Card>
        <CardHeader
          title="Play Store preview"
          description={
            competitor
              ? "Your listing now and after localization, next to the competitor."
              : "Your listing now and after localization. Add a competitor in the audit to compare."
          }
          actions={
            <>
              {localeOptions.length > 1 && (
                <Select
                  aria-label="Market to preview"
                  value={locale ?? ""}
                  onChange={(e) => setLocaleChoice(e.target.value)}
                  className="w-auto min-w-44"
                >
                  {localeOptions.map((l) => (
                    <option key={l} value={l}>
                      {LOCALE_MAP[l].label}
                    </option>
                  ))}
                </Select>
              )}
              <Button variant="primary" size="sm" disabled={!result} loading={exporting} onClick={onExport}>
                {exporting ? "Preparing ZIP" : "Download Fastlane ZIP"}
              </Button>
            </>
          }
        />
      </Card>

      <div className="pb-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {!analysis && !result ? (
          <Card className="min-h-[50vh] lg:h-full">
            <EmptyState title="Nothing to preview yet">
              Run an audit or generate a listing first. Both versions of your listing then appear side by side here.
            </EmptyState>
          </Card>
        ) : (
          <div className="mx-auto max-w-5xl rounded-2xl bg-[#f8f9fa] p-3 text-[#1f1f1f] shadow-card ring-1 ring-line sm:p-5">
            <div className="mb-5 flex items-center gap-3 rounded-full bg-white px-4 py-2.5 ring-1 ring-[#dadce0] sm:px-5">
              <span className="text-sm text-[#444746]">{query}</span>
              <span className="ml-auto hidden text-xs text-[#747775] sm:inline">Google Play, simulated</span>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <ResultCard listing={before} />
              {after ? <ResultCard listing={after} highlight /> : <Placeholder>Generate a listing to see the localized version.</Placeholder>}
              {competitor ? <ResultCard listing={competitor} /> : <Placeholder>No competitor in this audit.</Placeholder>}
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div>
                <p className="mb-2.5 text-xs font-medium text-[#444746]">Screenshots now</p>
                <div className="flex gap-2 overflow-x-auto">
                  {(analysis?.app.screenshots.slice(0, 3) ?? screenshots.map((s) => s.dataUrl)).map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={src} alt={`Current screenshot ${i + 1}`} className="h-48 w-auto rounded-lg object-cover ring-1 ring-[#dadce0]" />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2.5 text-xs font-medium text-[#444746]">
                  Posters after{optimized ? `, ${LOCALE_MAP[optimized.locale].label}` : ""}
                </p>
                <div className="flex gap-2 overflow-x-auto">
                  {optimized && result ? (
                    screenshots.map((shot, i) => (
                      <div
                        key={shot.id}
                        className="shrink-0 overflow-hidden rounded-lg ring-1 ring-[#dadce0]"
                        style={{ width: POSTER_WIDTH * 0.3, height: POSTER_HEIGHT * 0.3 }}
                      >
                        <div style={{ transform: "scale(0.3)", transformOrigin: "top left", width: POSTER_WIDTH, height: POSTER_HEIGHT }}>
                          <PosterCanvas
                            locale={optimized.locale}
                            screenshot={shot}
                            segments={result.segments[i] ?? []}
                            copy={optimized.posters[i] ?? optimized.posters[0] ?? { headline: "", subheadline: "" }}
                            backgroundDataUrl={optimized.backgroundDataUrl}
                            layout={layout}
                            textPosition={textPosition}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[#747775]">Posters appear after you generate a listing.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {result && (
          <p className="mx-auto mt-4 max-w-2xl text-center text-xs leading-relaxed text-muted">
            The ZIP follows the Fastlane layout: title, short and full description plus phone screenshots for{" "}
            {result.locales.length} market{result.locales.length === 1 ? "" : "s"}, ready for <span className="font-mono">fastlane supply</span>.
          </p>
        )}
      </div>
    </div>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-[#c4c7c5] p-6 text-center text-xs leading-relaxed text-[#747775]">
      {children}
    </div>
  );
}

function ResultCard({ listing, highlight = false }: { listing: Listing; highlight?: boolean }) {
  const rtl = listing.locale ? LOCALE_MAP[listing.locale].rtl : false;
  return (
    <div className={cn("flex flex-col gap-3 rounded-xl bg-white p-4 ring-1", highlight ? "ring-2 ring-accent" : "ring-[#dadce0]")}>
      <div className="flex items-center justify-between" dir="ltr">
        <Tag tone={highlight ? "accent" : "neutral"}>
          {VARIANT_LABEL[listing.variant]}
          {listing.locale ? `, ${LOCALE_MAP[listing.locale].label}` : ""}
        </Tag>
        <span className="font-mono text-[11px] text-[#747775]">
          title {listing.title.length}/30, short {listing.summary.length}/80
        </span>
      </div>
      <div className="flex items-center gap-3" dir={rtl ? "rtl" : "ltr"}>
        {listing.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.icon} alt="" className="h-14 w-14 rounded-[14px] object-cover" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-[14px] bg-ink font-display text-2xl text-paper">
            {listing.title.charAt(0)}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium leading-tight">{listing.title}</p>
          <p className="truncate text-xs text-[#444746]">{listing.developer}</p>
          <p className="text-xs text-[#444746]">
            {listing.rating.toFixed(1)} ★{listing.installs ? `, ${listing.installs}` : ""}
          </p>
        </div>
      </div>
      <p className="text-[13px] leading-snug text-[#444746]" dir={rtl ? "rtl" : "ltr"}>
        {listing.summary}
      </p>
      <span className="mt-auto self-end rounded-full bg-[#01875f] px-5 py-1.5 text-xs font-medium text-white">Install</span>
    </div>
  );
}
