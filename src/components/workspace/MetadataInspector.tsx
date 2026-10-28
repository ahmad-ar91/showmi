"use client";

import { CopyButton, Counter, Field, Tag, Textarea, Well } from "@/components/ui";
import { LOCALE_MAP } from "@/lib/locales";
import { PLAY_LIMITS, type LocaleCode, type LocaleResult, type PlayStoreMetadata } from "@/lib/types";
import { charCount, cn } from "@/lib/utils";

/** True when any listing field is over its Google Play limit. */
export function overLimit(r: LocaleResult) {
  return (
    charCount(r.metadata.title) > PLAY_LIMITS.title ||
    charCount(r.metadata.shortDescription) > PLAY_LIMITS.shortDescription ||
    charCount(r.metadata.fullDescription) > PLAY_LIMITS.fullDescription
  );
}

/** Editable title, short and full description for one market, with Play limit counters. */
export function ListingEditor({
  result,
  onMetadataChange,
}: {
  result: LocaleResult;
  onMetadataChange: (locale: LocaleCode, field: keyof PlayStoreMetadata, value: string) => void;
}) {
  const rtl = LOCALE_MAP[result.locale]?.rtl ?? false;
  const set = (field: keyof PlayStoreMetadata) => (v: string) => onMetadataChange(result.locale, field, v);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <MetaField label="App title" value={result.metadata.title} limit={PLAY_LIMITS.title} rows={1} rtl={rtl} onChange={set("title")} />
      <MetaField
        label="Short description"
        value={result.metadata.shortDescription}
        limit={PLAY_LIMITS.shortDescription}
        rows={2}
        rtl={rtl}
        onChange={set("shortDescription")}
      />
      <MetaField
        label="Full description"
        value={result.metadata.fullDescription}
        limit={PLAY_LIMITS.fullDescription}
        rows={16}
        rtl={rtl}
        onChange={set("fullDescription")}
      />

      {result.metadata.keywords.length > 0 && (
        <div>
          <p className="mb-2 text-[13px] font-medium text-ink">Keywords</p>
          <div className="flex flex-wrap gap-1.5" dir={rtl ? "rtl" : "ltr"}>
            {result.metadata.keywords.map((k) => (
              <Tag key={k}>{k}</Tag>
            ))}
          </div>
        </div>
      )}

      {result.culturalNote && (
        <Well className="text-[13px] leading-relaxed text-muted">
          <span className="font-medium text-ink">Why this wording. </span>
          {result.culturalNote}
        </Well>
      )}
    </div>
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
