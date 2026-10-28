import { toPng } from "html-to-image";
import JSZip from "jszip";
import { BRAND } from "./brand";
import { LOCALE_MAP } from "./locales";
import type { LocaleResult } from "./types";

/** Poster DOM size in CSS px; exported at 3x = 1080 x 1920 (Play Store phone screenshot). */
export const POSTER_WIDTH = 360;
export const POSTER_HEIGHT = 640;
const POSTER_RATIO = 3;

/** Feature graphic DOM size in CSS px; exported at 2x = 1024 x 500 (Play Store requirement). */
export const FEATURE_WIDTH = 512;
export const FEATURE_HEIGHT = 250;
const FEATURE_RATIO = 2;

export type ExportItem =
  | { kind: "poster"; locale: LocaleResult["locale"]; index: number; node: HTMLElement }
  | { kind: "feature"; locale: LocaleResult["locale"]; node: HTMLElement };

/** Kept for callers that only deal with posters. */
export type PosterNodeRef = Extract<ExportItem, { kind: "poster" }>;

function size(item: ExportItem) {
  return item.kind === "poster"
    ? { width: POSTER_WIDTH, height: POSTER_HEIGHT, pixelRatio: POSTER_RATIO }
    : { width: FEATURE_WIDTH, height: FEATURE_HEIGHT, pixelRatio: FEATURE_RATIO };
}

async function render(item: ExportItem): Promise<string> {
  // Wait for every image inside the node so nothing renders half-loaded.
  await Promise.all(
    Array.from(item.node.querySelectorAll("img")).map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => undefined))),
  );
  return toPng(item.node, {
    ...size(item),
    cacheBust: false,
    // The clone keeps exact dimensions even if the live node sits inside a scaled preview.
    style: { transform: "none", margin: "0" },
  });
}

function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function fileName(item: ExportItem) {
  const code = LOCALE_MAP[item.locale].playStoreCode;
  return item.kind === "poster" ? `poster_${code}_${item.index + 1}.png` : `feature-graphic_${code}.png`;
}

/** Downloads one poster or feature graphic as a PNG at store resolution. */
export async function downloadPng(item: ExportItem) {
  const png = await render(item);
  const bin = atob(dataUrlToBase64(png));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  triggerDownload(new Blob([bytes], { type: "image/png" }), fileName(item));
}

/**
 * Builds a Fastlane `supply`-compatible bundle:
 *   fastlane/metadata/android/<locale>/title.txt
 *   fastlane/metadata/android/<locale>/short_description.txt
 *   fastlane/metadata/android/<locale>/full_description.txt
 *   fastlane/metadata/android/<locale>/images/featureGraphic.png      (1024x500)
 *   fastlane/metadata/android/<locale>/images/phoneScreenshots/<n>.png (1080x1920)
 *
 * Fastlane `supply` sorts phoneScreenshots by file name, so posters are named 1.png, 2.png, …
 */
export async function exportFastlaneZip(
  results: LocaleResult[],
  items: ExportItem[],
  onProgress?: (done: number, total: number) => void,
) {
  const zip = new JSZip();
  const root = zip.folder("fastlane/metadata/android");
  if (!root) throw new Error("Could not create zip folder");

  for (const r of results) {
    const code = LOCALE_MAP[r.locale].playStoreCode;
    const dir = root.folder(code);
    if (!dir) continue;
    dir.file("title.txt", r.metadata.title);
    dir.file("short_description.txt", r.metadata.shortDescription);
    dir.file("full_description.txt", r.metadata.fullDescription);
    if (r.metadata.keywords.length) dir.file("keywords.txt", r.metadata.keywords.join(", "));
  }

  const total = items.length;
  let done = 0;
  onProgress?.(0, total);
  for (const item of items) {
    const png = await render(item);
    const code = LOCALE_MAP[item.locale].playStoreCode;
    const path = item.kind === "poster" ? `${code}/images/phoneScreenshots/${item.index + 1}.png` : `${code}/images/featureGraphic.png`;
    root.file(path, dataUrlToBase64(png), { base64: true });
    done += 1;
    onProgress?.(done, total);
  }

  zip.file(
    "showmi-manifest.json",
    JSON.stringify(
      {
        generator: `${BRAND.name} by ${BRAND.endorsedBy}`,
        exportedAt: new Date().toISOString(),
        locales: results.map((r) => ({
          locale: r.locale,
          playStoreCode: LOCALE_MAP[r.locale].playStoreCode,
          posters: r.posters,
          culturalNote: r.culturalNote,
        })),
      },
      null,
      2,
    ),
  );
  zip.file(
    "README.md",
    [
      `# ${BRAND.name} export`,
      "",
      "Google Play listing bundle in the standard Fastlane layout:",
      "",
      "```",
      "fastlane/metadata/android/<locale>/title.txt",
      "fastlane/metadata/android/<locale>/short_description.txt",
      "fastlane/metadata/android/<locale>/full_description.txt",
      "fastlane/metadata/android/<locale>/images/featureGraphic.png (1024x500)",
      "fastlane/metadata/android/<locale>/images/phoneScreenshots/1.png (1080x1920)",
      "```",
      "",
      "Deploy to Google Play Console with fastlane supply:",
      "",
      "```bash",
      "fastlane supply --package_name com.your.app --metadata_path ./fastlane/metadata/android --skip_upload_apk --skip_upload_aab",
      "```",
      "",
      `Locales: ${results.map((r) => LOCALE_MAP[r.locale].playStoreCode).join(", ")}`,
      "",
    ].join("\n"),
  );

  const blob = await zip.generateAsync({ type: "blob" });
  triggerDownload(blob, `showmi-fastlane-${Date.now()}.zip`);
}
