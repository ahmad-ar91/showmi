"use client";

import { useState } from "react";
import { Card, CardBody, CardHeader, CopyButton, Counter, EmptyState, Field, Tag, Tabs, Textarea, Well } from "@/components/ui";
import { LOCALE_MAP } from "@/lib/locales";
import { PLAY_LIMITS, type LocaleCode, type LocaleResult, type PlayStoreMetadata } from "@/lib/types";
import { charCount, cn } from "@/lib/utils";

interface Props {
  results: LocaleResult[] | null;
  onMetadataChange: (locale: LocaleCode, field: keyof PlayStoreMetadata, value: string) => void;
}

function overLimit(r: LocaleResult) {
  return (
    charCount(r.metadata.title) > PLAY_LIMITS.title ||
    charCount(r.metadata.shortDescription) > PLAY_LIMITS.shortDescription ||
    charCount(r.metadata.fullDescription) > PLAY_LIMITS.fullDescription
  );
}

export function MetadataInspector({ results, onMetadataChange }: Props) {
  const [selected, setSelected] = useState<LocaleCode | null>(null);
  // Derive the active tab instead of syncing it in an effect: fall back to the first locale
  // whenever the selected one is no longer part of the results.
  const active: LocaleCode | null =
    results?.length ? (selected && results.some((r) => r.locale === selected) ? selected : results[0].locale) : null;
  const current = results?.find((r) => r.locale === active) ?? null;
  const rtl = current ? LOCALE_MAP[current.locale].rtl : false;

  return (
    <Card className="h-full">
      <CardHeader title="Listing text" description="Edit freely. Counters follow the Play Console limits." />

      {results && results.length > 0 && (
        <Tabs
          label="Market"
          className="mx-5"
          value={active}
          onChange={setSelected}
          items={results.map((r) => ({ value: r.locale, label: LOCALE_MAP[r.locale].label, flagged: overLimit(r) }))}
        />
      )}

      <CardBody scroll className="pt-5">
        {!current && (
          <EmptyState title="Listing text appears here">
            A title, short description and full description for each market, ready to paste into the Play Console.
          </EmptyState>
        )}

        {current && (
          <div className="space-y-5">
            <MetaField
              label="App title"
              value={current.metadata.title}
              limit={PLAY_LIMITS.title}
              rows={1}
              rtl={rtl}
              onChange={(v) => onMetadataChange(current.locale, "title", v)}
            />
            <MetaField
              label="Short description"
              value={current.metadata.shortDescription}
              limit={PLAY_LIMITS.shortDescription}
              rows={2}
              rtl={rtl}
              onChange={(v) => onMetadataChange(current.locale, "shortDescription", v)}
            />
            <MetaField
              label="Full description"
              value={current.metadata.fullDescription}
              limit={PLAY_LIMITS.fullDescription}
              rows={14}
              rtl={rtl}
              onChange={(v) => onMetadataChange(current.locale, "fullDescription", v)}
            />

            {current.metadata.keywords.length > 0 && (
              <div>
                <p className="mb-2 text-[13px] font-medium text-ink">Keywords</p>
                <div className="flex flex-wrap gap-1.5" dir={rtl ? "rtl" : "ltr"}>
                  {current.metadata.keywords.map((k) => (
                    <Tag key={k}>{k}</Tag>
                  ))}
                </div>
              </div>
            )}

            {current.culturalNote && (
              <Well className="text-[13px] leading-relaxed text-muted">
                <span className="font-medium text-ink">Why this wording. </span>
                {current.culturalNote}
              </Well>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function MetaField({
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
  return (
    <Field
      label={label}
      aside={
        <span className="flex items-center gap-1">
          <Counter count={count} limit={limit} />
          <CopyButton text={value} />
        </span>
      }
      error={over ? `${count - limit} character${count - limit === 1 ? "" : "s"} over the Google Play limit.` : undefined}
    >
      <Textarea
        value={value}
        rows={rows}
        dir={rtl ? "rtl" : "ltr"}
        invalid={over}
        onChange={(e) => onChange(e.target.value)}
        className={cn(rows === 1 && "resize-none font-medium")}
      />
    </Field>
  );
}
