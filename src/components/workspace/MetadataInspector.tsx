"use client";

import { useState } from "react";
import { Check, Copy, FileText, Tags } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { LOCALE_MAP } from "@/lib/locales";
import { PLAY_LIMITS, type LocaleCode, type LocaleResult, type PlayStoreMetadata } from "@/lib/types";
import { charCount, cn } from "@/lib/utils";

interface Props {
  results: LocaleResult[] | null;
  onMetadataChange: (locale: LocaleCode, field: keyof PlayStoreMetadata, value: string) => void;
}

export function MetadataInspector({ results, onMetadataChange }: Props) {
  const [selected, setSelected] = useState<LocaleCode | null>(null);
  // Derive the active tab instead of syncing it in an effect: fall back to the first locale
  // whenever the selected one is no longer part of the results.
  const active: LocaleCode | null =
    results?.length ? (selected && results.some((r) => r.locale === selected) ? selected : results[0].locale) : null;

  const current = results?.find((r) => r.locale === active) ?? null;

  return (
    <Panel className="h-full">
      <PanelHeader
        icon={<FileText size={16} />}
        title="Listing text"
        subtitle="Title 30, short 80, full 4000 characters"
      />

      {results && results.length > 0 && (
        <div className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2">
          {results.map((r) => {
            const loc = LOCALE_MAP[r.locale];
            const over =
              charCount(r.metadata.title) > PLAY_LIMITS.title ||
              charCount(r.metadata.shortDescription) > PLAY_LIMITS.shortDescription ||
              charCount(r.metadata.fullDescription) > PLAY_LIMITS.fullDescription;
            return (
              <button
                key={r.locale}
                type="button"
                onClick={() => setSelected(r.locale)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                  active === r.locale ? "bg-sunken text-panel" : "text-muted hover:text-panel",
                )}
              >
                <span>{loc.flag}</span>
                {loc.code}
                {over && <span className="h-1.5 w-1.5 rounded-full bg-bad" />}
              </button>
            );
          })}
        </div>
      )}

      <PanelBody>
        {!current && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <FileText size={22} className="mb-3 text-faint" />
            <p className="font-display text-lg text-ink">Listing text appears here</p>
            <p className="mt-1 max-w-xs text-xs text-muted">
              Title, short and full description per locale, with live character counters and copy buttons.
            </p>
          </div>
        )}

        {current && (
          <div className="space-y-5" dir={LOCALE_MAP[current.locale].rtl ? "rtl" : "ltr"}>
            <Field
              label="App title"
              value={current.metadata.title}
              limit={PLAY_LIMITS.title}
              rows={1}
              rtl={LOCALE_MAP[current.locale].rtl}
              onChange={(v) => onMetadataChange(current.locale, "title", v)}
            />
            <Field
              label="Short description"
              value={current.metadata.shortDescription}
              limit={PLAY_LIMITS.shortDescription}
              rows={2}
              rtl={LOCALE_MAP[current.locale].rtl}
              onChange={(v) => onMetadataChange(current.locale, "shortDescription", v)}
            />
            <Field
              label="Full description"
              value={current.metadata.fullDescription}
              limit={PLAY_LIMITS.fullDescription}
              rows={14}
              rtl={LOCALE_MAP[current.locale].rtl}
              onChange={(v) => onMetadataChange(current.locale, "fullDescription", v)}
            />

            {current.metadata.keywords.length > 0 && (
              <div dir="ltr">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted">
                  <Tags size={12} /> Keywords
                </div>
                <div className="flex flex-wrap gap-1.5" dir={LOCALE_MAP[current.locale].rtl ? "rtl" : "ltr"}>
                  {current.metadata.keywords.map((k) => (
                    <Badge key={k}>{k}</Badge>
                  ))}
                </div>
              </div>
            )}

            {current.culturalNote && (
              <p className="rounded-lg border border-line bg-sunken p-3 text-[11px] leading-relaxed text-muted" dir="ltr">
                <span className="font-semibold text-ink">Cultural note: </span>
                {current.culturalNote}
              </p>
            )}
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}

function Field({
  label,
  value,
  limit,
  rows,
  rtl,
  onChange,
}: {
  label: string;
  value: string;
  limit: number;
  rows: number;
  rtl: boolean;
  onChange: (v: string) => void;
}) {
  const count = charCount(value);
  const over = count > limit;
  const near = !over && count >= limit * 0.9;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between" dir="ltr">
        <label className="text-xs font-semibold text-muted">{label}</label>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "font-mono text-[11px] tabular-nums",
              over ? "text-bad" : near ? "text-warn" : "text-muted",
            )}
          >
            {count}/{limit}
          </span>
          <CopyButton text={value} />
        </div>
      </div>
      <textarea
        value={value}
        rows={rows}
        dir={rtl ? "rtl" : "ltr"}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full resize-y rounded-lg border bg-sunken px-3 py-2 text-sm leading-relaxed focus:outline-none",
          over ? "border-bad focus:border-bad" : "border-line focus:border-accent",
          rows === 1 && "resize-none font-medium",
        )}
      />
      {over && (
        <p className="mt-1 text-[11px] text-bad" dir="ltr">
          Exceeds Google Play limit by {count - limit} character{count - limit === 1 ? "" : "s"}.
        </p>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable (e.g. insecure context) */
        }
      }}
      className={cn(
        "flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] transition-colors",
        copied
          ? "border-ok/30 bg-ok-soft text-ok"
          : "border-line text-ink hover:bg-sunken",
      )}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
