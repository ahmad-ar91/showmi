/**
 * Browser side of "Publish to Google Play": walks one Google Play edit step by step through
 * /api/play, one small request per step, then validates it and either commits or discards it.
 */
import { postJson } from "./client-api";
import { renderJpegBlob, type ExportItem } from "./export";
import { LOCALE_MAP } from "./locales";
import type { LocaleResult } from "./types";

export interface PlayStatus {
  configured: boolean;
  serviceAccount: string | null;
  packages: string[];
  error?: string;
}

/** "check" uploads everything into an edit, validates it and throws it away; "publish" commits it. */
export type PublishMode = "check" | "publish";

export interface PublishProgress {
  done: number;
  total: number;
  label: string;
}

async function uploadImage(query: Record<string, string>, blob: Blob): Promise<void> {
  const res = await fetch(`/api/play?${new URLSearchParams({ action: "upload", ...query })}`, {
    method: "POST",
    headers: { "Content-Type": blob.type || "image/jpeg" },
    body: blob,
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `Upload failed (${res.status}).`);
  }
}

export async function publishToPlay({
  packageName,
  results,
  items,
  mode,
  onProgress,
}: {
  packageName: string;
  results: LocaleResult[];
  items: ExportItem[];
  mode: PublishMode;
  onProgress?: (p: PublishProgress) => void;
}): Promise<void> {
  const plan = results.map((r) => ({
    result: r,
    language: LOCALE_MAP[r.locale].playStoreCode,
    posters: items
      .filter((i): i is Extract<ExportItem, { kind: "poster" }> => i.kind === "poster" && i.locale === r.locale)
      .sort((a, b) => a.index - b.index),
    feature: items.find((i) => i.kind === "feature" && i.locale === r.locale),
  }));
  const total =
    2 + // open, validate
    (mode === "publish" ? 1 : 0) +
    plan.reduce((n, p) => n + 1 + (p.posters.length ? 1 + p.posters.length : 0) + (p.feature ? 2 : 0), 0);
  let done = 0;
  const step = (label: string) => onProgress?.({ done: done++, total, label });

  step("Opening an edit");
  const { editId } = await postJson<{ editId: string }>("/api/play", { action: "open", packageName });
  const base = { packageName, editId };
  try {
    for (const p of plan) {
      const name = LOCALE_MAP[p.result.locale].label;
      step(`${name}: listing text`);
      await postJson("/api/play", { ...base, action: "listing", language: p.language, listing: p.result.metadata });
      if (p.posters.length) {
        step(`${name}: removing old screenshots`);
        await postJson("/api/play", { ...base, action: "clear", language: p.language, imageType: "phoneScreenshots" });
        for (const poster of p.posters) {
          step(`${name}: screenshot ${poster.index + 1}`);
          await uploadImage({ ...base, language: p.language, imageType: "phoneScreenshots" }, await renderJpegBlob(poster));
        }
      }
      if (p.feature) {
        step(`${name}: removing old feature graphic`);
        await postJson("/api/play", { ...base, action: "clear", language: p.language, imageType: "featureGraphic" });
        step(`${name}: feature graphic`);
        await uploadImage({ ...base, language: p.language, imageType: "featureGraphic" }, await renderJpegBlob(p.feature));
      }
    }
    step("Validating with Google Play");
    await postJson("/api/play", { ...base, action: "validate" });
    if (mode === "publish") {
      step("Publishing");
      await postJson("/api/play", { ...base, action: "commit" });
    } else {
      await postJson("/api/play", { ...base, action: "discard" });
    }
    onProgress?.({ done: total, total, label: mode === "publish" ? "Published" : "Check passed" });
  } catch (err) {
    // Leave nothing half-done on Google Play.
    await postJson("/api/play", { ...base, action: "discard" }).catch(() => undefined);
    throw err;
  }
}
