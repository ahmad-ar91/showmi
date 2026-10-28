import { toPng } from "html-to-image";
import JSZip from "jszip";
import { BRAND } from "./brand";
import { LOCALE_MAP } from "./locales";
import type { LocaleResult } from "./types";

/** Poster DOM size in CSS px; exported at 3x = 1080 x 1920 (Play Store friendly). */
export const POSTER_WIDTH = 360;
export const POSTER_HEIGHT = 640;
const EXPORT_PIXEL_RATIO = 3;

export interface PosterNodeRef {
  locale: LocaleResult["locale"];
  index: number;
  node: HTMLElement;
}

async function renderPoster(node: HTMLElement): Promise<string> {
  return toPng(node, {
    pixelRatio: EXPORT_PIXEL_RATIO,
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    cacheBust: false,
    // Ensure the clone keeps exact dimensions even if the live node is scaled via transform.
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

export async function downloadPosterPng(ref: PosterNodeRef) {
  const png = await renderPoster(ref.node);
  const bin = atob(dataUrlToBase64(png));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const code = LOCALE_MAP[ref.locale].playStoreCode;
  triggerDownload(new Blob([bytes], { type: "image/png" }), `poster_${code}_${ref.index + 1}.png`);
}

/**
 * Builds a Fastlane `supply`-compatible bundle:
 *   fastlane/metadata/android/<locale>/title.txt
 *   fastlane/metadata/android/<locale>/short_description.txt
 *   fastlane/metadata/android/<locale>/full_description.txt
 *   fastlane/metadata/android/<locale>/images/phoneScreenshots/<n>.png
 *
 * Fastlane `supply` sorts phoneScreenshots by file name, so posters are named 1.png, 2.png, …
 * Ready to run: fastlane supply --metadata_path fastlane/metadata/android --skip_upload_apk
 */
export async function exportFastlaneZip(
  results: LocaleResult[],
  posterRefs: PosterNodeRef[],
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

  const total = posterRefs.length;
  let done = 0;
  onProgress?.(0, total);
  for (const ref of posterRefs) {
    const png = await renderPoster(ref.node);
    const code = LOCALE_MAP[ref.locale].playStoreCode;
    root.file(`${code}/images/phoneScreenshots/${ref.index + 1}.png`, dataUrlToBase64(png), { base64: true });
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
