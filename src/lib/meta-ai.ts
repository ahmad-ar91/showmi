/**
 * ShowMi service layer / orchestrator.
 *
 * Talks only to the provider-agnostic interfaces in `src/lib/ai` so the vendor behind each
 * capability (text, image, segmentation) can be swapped with env vars:
 *   AI_PROVIDER / AI_TEXT_PROVIDER / AI_IMAGE_PROVIDER / AI_SEGMENT_PROVIDER = meta | google | deepseek | mock
 * Default is Meta Model API (Muse Spark, Muse Image, SAM 3.1). Any live call that fails degrades
 * to the simulated provider and reports a warning, so the UI always gets a result.
 */
import "server-only";
import { getImageProvider, getSegmentProvider, getTextProvider, providerStatus } from "./ai/registry";
import { enforceLimits, mockBackground, mockSegments, mockSpark, type SparkOutput } from "./ai/providers/mock";
import type { DetectedBox } from "./ai/types";
import { LOCALE_MAP } from "./locales";
import type { GenerateAsoRequest, GenerateAsoResponse, LocaleCode, LocaleResult, Segment } from "./types";
import { PLAY_LIMITS } from "./types";

export { providerStatus };
export type { SparkOutput };

export function isMockMode(): boolean {
  return providerStatus().mode === "mock";
}

/* -------------------------------------------------------------------------- */
/*  1. UI element segmentation                                                 */
/* -------------------------------------------------------------------------- */

/** Short noun phrases segmentation models match well on mobile UI screenshots. */
export const UI_SEGMENT_PROMPTS = ["rounded rectangle", "button", "purple card", "banner"];
const MAX_SEGMENTS = 6;

/** Human label for a detected region, from the prompt that found it and the box shape. */
function labelFor(prompt: string, bbox: Segment["bbox"]): string {
  const p = prompt.toLowerCase();
  if (p.includes("button")) return "Button";
  if (p.includes("banner")) return "Banner";
  if (p.includes("icon")) return "Icon";
  const aspect = bbox.w / Math.max(bbox.h, 0.001);
  if (aspect > 4.5) return "List Item";
  if (bbox.w > 0.6) return "Card";
  return "Tile";
}

function iou(a: Segment["bbox"], b: Segment["bbox"]): number {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const inter = ix * iy;
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}

/** Filters, de-duplicates and ranks raw detections into badge-worthy segments. */
export function refineDetections(boxes: DetectedBox[], index: number, max = MAX_SEGMENTS): Segment[] {
  const candidates = boxes
    .filter((b) => {
      const area = b.bbox.w * b.bbox.h;
      // Skip specks and near-full-screen matches: neither makes a good floating badge.
      return area >= 0.01 && area <= 0.6 && b.bbox.w > 0 && b.bbox.h > 0;
    })
    .map((b) => ({ id: "", label: labelFor(b.label, b.bbox), score: b.score, bbox: b.bbox }))
    .sort((a, b) => b.score - a.score);
  const kept: Segment[] = [];
  for (const c of candidates) {
    if (kept.some((k) => iou(k.bbox, c.bbox) > 0.5)) continue;
    kept.push(c);
    if (kept.length >= max) break;
  }
  return kept.map((s, i) => ({ ...s, id: `s${index}-seg${i}` }));
}

export async function segmentScreenshot(screenshotDataUrl: string, index: number): Promise<Segment[]> {
  const provider = getSegmentProvider();
  if (provider.name === "mock") return mockSegments(index);
  const boxes = await provider.segment({ imageDataUrl: screenshotDataUrl, prompts: UI_SEGMENT_PROMPTS, hint: index });
  return refineDetections(boxes, index);
}

/** Segment one screenshot, degrading to simulated regions on failure or zero matches. */
export async function segmentWithFallback(
  screenshotDataUrl: string,
  index: number,
): Promise<{ segments: Segment[]; mode: "mock" | "live"; warning?: string }> {
  const provider = getSegmentProvider();
  if (provider.name === "mock") return { segments: mockSegments(index), mode: "mock" };
  try {
    const segments = await segmentScreenshot(screenshotDataUrl, index);
    if (segments.length) return { segments, mode: "live" };
    return {
      segments: mockSegments(index),
      mode: "mock",
      warning: `${provider.model} found no UI regions in this screenshot; showing simulated regions instead.`,
    };
  } catch (err) {
    return {
      segments: mockSegments(index),
      mode: "mock",
      warning: `Segmentation (screenshot ${index + 1}): ${(err as Error).message} (used simulated output)`,
    };
  }
}

/* -------------------------------------------------------------------------- */
/*  2. Multilingual ASO metadata (JSON)                                        */
/* -------------------------------------------------------------------------- */

export interface LocaleMetadataParams {
  appName: string;
  description: string;
  locale: LocaleCode;
  screenshots: string[];
  /** High-intent keywords to weave in naturally (from the ASO analytics keyword-gap table). */
  keywords?: string[];
  /** Weaknesses detected by the analytics audit that the copy should address. */
  weaknesses?: string[];
}

export async function generateLocaleMetadata(params: LocaleMetadataParams): Promise<SparkOutput> {
  const provider = getTextProvider();
  if (provider.name === "mock") return mockSpark(params);

  const loc = LOCALE_MAP[params.locale];
  const n = params.screenshots.length;
  const system = `You are an expert App Store Optimization (ASO) copywriter and cultural localizer.
Return ONLY valid JSON matching this TypeScript type:
{
  "metadata": {
    "title": string,            // Google Play title, MAX ${PLAY_LIMITS.title} characters
    "shortDescription": string, // MAX ${PLAY_LIMITS.shortDescription} characters
    "fullDescription": string,  // MAX ${PLAY_LIMITS.fullDescription} characters, use paragraphs + bullet-like lines
    "keywords": string[]        // 5-8 locale-native search keywords
  },
  "posters": { "headline": string, "subheadline": string }[], // exactly ${n} entries, one per screenshot, headline <= 28 chars, subheadline <= 60 chars
  "culturalNote": string        // one sentence on cultural adaptation choices
}
All text must be written natively in ${loc.language} (not a literal translation), using local idioms and tone. ${loc.rtl ? "The language is right-to-left." : ""}`;

  const extras = [
    params.keywords?.length
      ? `Weave these high-intent keywords in naturally (translated/localised where sensible): ${params.keywords.join(", ")}.`
      : "",
    params.weaknesses?.length ? `Fix these weaknesses found in the current listing: ${params.weaknesses.join("; ")}.` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const user = `App name: ${params.appName}\nApp description: ${params.description}\nTarget market: ${loc.label} (${loc.code}).\n${extras}\nAnalyse the attached screenshots and write the listing + poster copy.`;

  const parsed = await provider.chatJson<SparkOutput>({ system, user, images: params.screenshots });
  return enforceLimits(parsed, n);
}

/* -------------------------------------------------------------------------- */
/*  3. Culturally-aware poster backgrounds                                     */
/* -------------------------------------------------------------------------- */

export async function generateBackground(params: { locale: LocaleCode; description: string }): Promise<string> {
  const provider = getImageProvider();
  if (provider.name === "mock") return mockBackground(params.locale);
  const loc = LOCALE_MAP[params.locale];
  const prompt = `Abstract, premium app-store poster background for a mobile app (${params.description.slice(0, 120)}). Vertical 9:16 portrait, soft gradient, subtle cultural motif inspired by ${loc.label}, no text, no letters, no people, no logos, lots of calm negative space in the centre for a phone mockup.`;
  return provider.generateImage({ prompt, aspect: "9:16", hint: params.locale });
}

/** Wide art for the Google Play feature graphic: calm on one side for copy, space for a phone on the other. */
export async function generateFeatureArt(params: { locale: LocaleCode; description: string }): Promise<string> {
  const provider = getImageProvider();
  if (provider.name === "mock") return mockBackground(params.locale);
  const loc = LOCALE_MAP[params.locale];
  const side = loc.rtl ? "right" : "left";
  const prompt = `Wide 2:1 banner background for a mobile app store feature graphic (${params.description.slice(0, 120)}). Rich gradient with a subtle cultural motif inspired by ${loc.label}. Keep the ${side} half calm and darker for headline text, lighter open space on the other side for a phone mockup. No text, no letters, no people, no logos, no devices.`;
  return provider.generateImage({ prompt, aspect: "16:9", hint: params.locale });
}

/** Generates feature graphic art for several markets, falling back to the simulated art per market. */
export async function generateFeatureArtFor(
  locales: LocaleCode[],
  description: string,
): Promise<{ art: Record<LocaleCode, string>; warnings: string[]; mode: "mock" | "live" }> {
  const provider = getImageProvider();
  const warnings: string[] = [];
  const entries = await mapLimit(locales, Number(process.env.AI_CONCURRENCY) || 4, async (locale) => {
    try {
      return [locale, await generateFeatureArt({ locale, description })] as const;
    } catch (err) {
      warnings.push(`${provider.model} (${locale}): ${(err as Error).message} (used simulated art)`);
      return [locale, mockBackground(locale)] as const;
    }
  });
  return { art: Object.fromEntries(entries), warnings, mode: provider.name === "mock" ? "mock" : "live" };
}

/* -------------------------------------------------------------------------- */
/*  Orchestrator                                                               */
/* -------------------------------------------------------------------------- */

/** Like Promise.all over items.map(fn), but with at most `limit` calls in flight. Keeps order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

function deriveAppName(req: GenerateAsoRequest): string {
  if (req.appName?.trim()) return req.appName.trim().slice(0, 20);
  const words = req.description
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const guess = words.slice(0, 2).join(" ");
  return guess ? guess.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 20) : "YourApp";
}

/**
 * Runs the full multimodal pipeline:
 *   screenshots                -> segmentation (per screenshot, unless the UI already picked regions)
 *   screenshots + description  -> text model   (per-locale metadata & poster copy)
 *   description + locale       -> image model  (per-locale background)
 */
export async function generateAsoPackage(req: GenerateAsoRequest): Promise<GenerateAsoResponse> {
  const status = providerStatus();
  const warnings: string[] = [];
  const appName = deriveAppName(req);

  const withFallback = async <T>(label: string, live: () => Promise<T>, mock: () => T | Promise<T>) => {
    try {
      return await live();
    } catch (err) {
      warnings.push(`${label}: ${(err as Error).message} (used simulated output)`);
      return mock();
    }
  };

  const segments = await Promise.all(
    req.screenshots.map((shot, i) => {
      const picked = req.segments?.[i];
      if (picked && picked.length) return Promise.resolve(picked);
      return withFallback(
        `Segmentation (screenshot ${i + 1})`,
        () => segmentScreenshot(shot, i),
        () => mockSegments(i),
      );
    }),
  );

  // Each market costs one text and one image call; cap how many run at once so a long
  // market list does not trip provider rate limits.
  const locales: LocaleResult[] = await mapLimit(
    req.locales,
    Number(process.env.AI_CONCURRENCY) || 4,
    async (locale) => {
      const params: LocaleMetadataParams = {
        appName,
        description: req.description,
        locale,
        screenshots: req.screenshots,
        keywords: req.keywords,
        weaknesses: req.weaknesses,
      };
      const [spark, backgroundDataUrl] = await Promise.all([
        withFallback(
          `${status.text.model} (${locale})`,
          () => generateLocaleMetadata(params),
          () => mockSpark(params),
        ),
        withFallback(
          `${status.image.model} (${locale})`,
          () => generateBackground({ locale, description: req.description }),
          () => mockBackground(locale),
        ),
      ]);
      return {
        locale,
        metadata: spark.metadata,
        posters: spark.posters,
        culturalNote: spark.culturalNote,
        backgroundDataUrl,
      };
    },
  );

  return {
    mode: status.mode,
    segments,
    locales,
    warnings,
    generatedAt: new Date().toISOString(),
  };
}
