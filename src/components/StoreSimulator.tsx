"use client";

import { useState } from "react";
import { Download, Loader2, Package, Search, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
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

interface ListingCard {
  key: string;
  variant: "before" | "after" | "competitor";
  title: string;
  summary: string;
  rating: number;
  installs: string;
  icon?: string;
  developer: string;
  locale?: LocaleCode;
}

/**
 * Tab 3: a Google Play search-results mock-up showing our listing before vs. after
 * optimisation, right next to the competitor, plus the one-click Fastlane export.
 */
export function StoreSimulator({ analysis, result, screenshots, appName, description, layout, textPosition, exporting, onExport }: Props) {
  const localeOptions = result?.locales.map((l) => l.locale) ?? [];
  const [localeChoice, setLocaleChoice] = useState<LocaleCode | null>(null);
  const locale = localeChoice && localeOptions.includes(localeChoice) ? localeChoice : (localeOptions[0] ?? null);
  const optimized = locale ? result?.locales.find((l) => l.locale === locale) : undefined;

  const before: ListingCard = analysis
    ? {
        key: "before",
        variant: "before",
        title: analysis.app.title,
        summary: analysis.app.summary,
        rating: analysis.app.score,
        installs: analysis.app.installs,
        icon: analysis.app.icon,
        developer: analysis.app.developer,
      }
    : {
        key: "before",
        variant: "before",
        title: appName || "Your app",
        summary: description.slice(0, 80) || "Current short description",
        rating: 4.3,
        installs: "—",
        developer: "You",
      };

  const after: ListingCard | null = optimized
    ? {
        key: "after",
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

  const competitor: ListingCard | null = analysis?.competitor
    ? {
        key: "competitor",
        variant: "competitor",
        title: analysis.competitor.title,
        summary: analysis.competitor.summary,
        rating: analysis.competitor.score,
        installs: analysis.competitor.installs,
        icon: analysis.competitor.icon,
        developer: analysis.competitor.developer,
      }
    : null;

  const query = analysis ? analysis.app.genre.toLowerCase() : appName || "your app";

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <Panel>
        <PanelHeader
          icon={<Store size={16} />}
          title="Play Store preview"
          subtitle="Your listing before and after, next to a competitor if you added one"
          right={
            <div className="flex items-center gap-2">
              {localeOptions.length > 0 && (
                <select
                  value={locale ?? ""}
                  onChange={(e) => setLocaleChoice(e.target.value as LocaleCode)}
                  className="h-8 rounded-lg border border-line bg-sunken px-2 text-xs"
                >
                  {localeOptions.map((l) => (
                    <option key={l} value={l}>
                      {LOCALE_MAP[l].flag} {LOCALE_MAP[l].label}
                    </option>
                  ))}
                </select>
              )}
              <Button variant="primary" size="sm" disabled={!result || exporting} onClick={onExport}>
                {exporting ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />}
                Download Fastlane ZIP
              </Button>
            </div>
          }
        />
      </Panel>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Phone-like Play Store frame */}
        <div className="mx-auto max-w-5xl rounded-3xl border border-line bg-[#f8f9fa] p-4 text-zinc-900 shadow-2xl">
          <div className="mb-4 flex items-center gap-3 rounded-full bg-white px-4 py-2.5 shadow-sm ring-1 ring-zinc-200">
            <Search size={16} className="text-muted" />
            <span className="text-sm text-faint">{query}</span>
            <span className="ml-auto text-[10px] text-muted">Simulated Google Play</span>
          </div>

          {!analysis && !result && (
            <p className="py-16 text-center text-sm text-muted">
              Run an audit in Tab 1 and generate localized assets in Tab 2 to compare listings here.
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <ResultCard card={before} />
            {after ? (
              <ResultCard card={after} />
            ) : (
              <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 p-6 text-center text-xs text-muted">
                Generate in the Localization Studio to see the optimised listing
              </div>
            )}
            {competitor ? (
              <ResultCard card={competitor} />
            ) : (
              <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 p-6 text-center text-xs text-muted">
                Add a competitor in the audit to compare side by side
              </div>
            )}
          </div>

          {/* Screenshot strip: before (original) vs after (poster) */}
          {(analysis || result) && (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-[11px] font-semibold text-muted">Before: current screenshots</p>
                <div className="flex gap-2 overflow-x-auto">
                  {(analysis?.app.screenshots.slice(0, 3) ?? screenshots.map((s) => s.dataUrl)).map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={src} alt="" className="h-48 w-auto rounded-lg border border-zinc-200 object-cover" />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[11px] font-semibold text-muted">
                  After: localized posters {optimized ? `(${LOCALE_MAP[optimized.locale].label})` : ""}
                </p>
                <div className="flex gap-2 overflow-x-auto">
                  {optimized && result
                    ? screenshots.map((shot, i) => (
                        <div
                          key={shot.id}
                          className="shrink-0 overflow-hidden rounded-lg border border-zinc-200"
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
                    : (
                        <p className="text-xs text-muted">Posters appear after generation.</p>
                      )}
                </div>
              </div>
            </div>
          )}
        </div>

        {result && (
          <p className="mx-auto mt-3 max-w-5xl text-center text-[11px] text-muted">
            <Download size={11} className="mr-1 inline" />
            The ZIP contains fastlane/metadata/android/&lt;locale&gt;/title.txt, short_description.txt, full_description.txt
            and images/phoneScreenshots/1.png… for {result.locales.length} locale{result.locales.length === 1 ? "" : "s"}.
          </p>
        )}
      </div>
    </div>
  );
}

function ResultCard({ card }: { card: ListingCard }) {
  const tone = { before: "bg-zinc-200 text-faint", after: "bg-accent text-panel", competitor: "bg-amber-400 text-amber-950" }[card.variant];
  const label = { before: "Before", after: `After, ${card.locale ? LOCALE_MAP[card.locale].label : ""}`, competitor: "Competitor" }[card.variant];
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg bg-white p-4 shadow-sm ring-1",
        card.variant === "after" ? "ring-2 ring-violet-500" : "ring-zinc-200",
      )}
      dir={card.locale && LOCALE_MAP[card.locale].rtl ? "rtl" : "ltr"}
    >
      <span className={cn("self-start rounded-full px-2 py-0.5 text-[10px] font-semibold", tone)} dir="ltr">
        {label}
      </span>
      <div className="flex items-center gap-3">
        {card.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.icon} alt="" className="h-14 w-14 rounded-lg object-cover" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent text-panel">
            <Store size={20} />
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{card.title}</p>
          <p className="truncate text-xs text-muted">{card.developer}</p>
          <p className="text-xs text-faint">
            <span className="font-medium">{card.rating.toFixed(1)}</span>
            <span className="text-amber-500"> ★</span>
            <span className="text-muted">, {card.installs || "no install data"}</span>
          </p>
        </div>
      </div>
      <p className="text-xs leading-snug text-faint">{card.summary}</p>
      <div className="mt-auto flex items-center justify-between pt-1" dir="ltr">
        <Badge className="border-zinc-200 bg-zinc-100 text-faint">
          Title {card.title.length}/30, short {card.summary.length}/80
        </Badge>
        <span className="rounded-full bg-[#01875f] px-4 py-1 text-xs font-semibold text-panel">Install</span>
      </div>
    </div>
  );
}
