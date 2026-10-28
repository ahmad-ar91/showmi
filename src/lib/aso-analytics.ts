/**
 * ASO Intelligence: audits a Google Play listing, optionally against a competitor, using
 *   - the segmentation provider (SAM 3.1 by default) for a visual teardown of screenshots
 *   - the text provider (Muse Spark / Wonder by default) for scoring, critique and keyword gaps
 *   - deterministic checks for Google Play metadata compliance
 */
import "server-only";
import { getSegmentProvider, getTextProvider, providerStatus } from "./ai/registry";
import { mockSegments } from "./ai/providers/mock";
import { toDataUrl } from "./ai/types";
import { refineDetections, UI_SEGMENT_PROMPTS } from "./meta-ai";
import type { StoreListing } from "./play-store";
import { PLAY_LIMITS, type Segment } from "./types";
import { charCount } from "./utils";

/* ----------------------------------- Types ----------------------------------- */

export interface AsoMetrics {
  keywordOptimization: number;
  visualClarity: number;
  culturalFit: number;
  ctaStrength: number;
  metadataCompliance: number;
}

export interface ComplianceCheck {
  field: "title" | "shortDescription" | "fullDescription";
  length: number;
  limit: number;
  ok: boolean;
}

export interface VisualAudit {
  index: number;
  /** Original Play Store CDN URL (for display). */
  screenshotUrl: string;
  /** Downscaled data URL so the Localization Studio can reuse it without CORS issues. */
  screenshotDataUrl: string;
  segments: Segment[];
  /** 0 = clean, 100 = extremely busy. */
  clutterScore: number;
  /** Share of the frame covered by detected UI regions, 0..1. */
  coverage: number;
  /** Normalised centre of visual weight, 0..1. */
  focalPoint: { x: number; y: number };
  critique: string;
  /** 0..100 visual effectiveness score. */
  score: number;
}

export interface KeywordGap {
  keyword: string;
  /** How many times the competitor listing uses it (0 when audited without a competitor). */
  competitorCount: number;
  /** 1..100 estimated ranking difficulty. */
  difficulty: number;
  /** 1..100 relevance to our app. */
  relevance: number;
  /** Suggested placement. */
  placement: "title" | "short" | "full";
}

export interface AsoAnalysis {
  app: StoreListing;
  /** Null when the audit ran without a competitor. */
  competitor: StoreListing | null;
  healthScore: number;
  metrics: AsoMetrics;
  compliance: ComplianceCheck[];
  visual: VisualAudit[];
  keywordGaps: KeywordGap[];
  weaknesses: string[];
  strengths: string[];
  recommendations: string[];
  /** Weakest screenshot indices, to be regenerated as posters in the studio. */
  weakScreenshots: number[];
  mode: "mock" | "live";
  warnings: string[];
  generatedAt: string;
}

/* ------------------------------ Deterministic parts ------------------------------ */

export function checkCompliance(l: StoreListing): ComplianceCheck[] {
  const rows: [ComplianceCheck["field"], string, number][] = [
    ["title", l.title, PLAY_LIMITS.title],
    ["shortDescription", l.summary, PLAY_LIMITS.shortDescription],
    ["fullDescription", l.description, PLAY_LIMITS.fullDescription],
  ];
  return rows.map(([field, text, limit]) => {
    const length = charCount(text);
    return { field, length, limit, ok: length > 0 && length <= limit };
  });
}

const STOPWORDS = new Set(
  "the a an and or of to in on for with your you our is are be it its this that at by from as can will more new get all any one over into about just also than then them they we us up out so no not do does have has".split(" "),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
}

function countTerms(text: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const w of tokenize(text)) m.set(w, (m.get(w) ?? 0) + 1);
  return m;
}

/**
 * Without a competitor: common high-intent store search terms that the listing never mentions.
 * Used by the simulated analysis and as a hint for the model.
 */
// Category-neutral modifiers only; the live model infers category-specific terms itself.
const OPPORTUNITY_TERMS = [
  "free", "offline", "daily", "beginner", "easy", "fast", "private", "secure", "ad-free",
  "family", "personalized", "progress", "community", "premium", "unlimited",
];

export function keywordOpportunityHeuristic(app: StoreListing, max = 8): KeywordGap[] {
  const ours = countTerms(`${app.title} ${app.summary} ${app.description}`);
  const genre = tokenize(app.genre);
  return [...genre, ...OPPORTUNITY_TERMS]
    .filter((kw, i, all) => all.indexOf(kw) === i && !ours.has(kw))
    .slice(0, max)
    .map((keyword, i) => ({
      keyword,
      competitorCount: 0,
      difficulty: 40 + ((i * 13) % 45),
      relevance: Math.max(45, 90 - i * 5),
      placement: i < 2 ? ("short" as const) : ("full" as const),
    }));
}

/** Keyword candidates the competitor repeats but our listing never mentions. */
export function keywordGapHeuristic(app: StoreListing, competitor: StoreListing, max = 10): KeywordGap[] {
  const ours = countTerms(`${app.title} ${app.summary} ${app.description}`);
  const theirs = countTerms(`${competitor.title} ${competitor.summary} ${competitor.description}`);
  const gaps: KeywordGap[] = [];
  for (const [kw, count] of theirs) {
    if (count < 2 || ours.has(kw)) continue;
    const difficulty = Math.min(95, 30 + count * 7);
    const relevance = Math.min(95, 45 + count * 6);
    gaps.push({ keyword: kw, competitorCount: count, difficulty, relevance, placement: count >= 5 ? "short" : "full" });
  }
  return gaps.sort((a, b) => b.competitorCount - a.competitorCount).slice(0, max);
}

function visualStats(segments: Segment[]): Pick<VisualAudit, "clutterScore" | "coverage" | "focalPoint"> {
  if (!segments.length) return { clutterScore: 15, coverage: 0, focalPoint: { x: 0.5, y: 0.45 } };
  const coverage = Math.min(1, segments.reduce((s, g) => s + g.bbox.w * g.bbox.h, 0));
  const clutterScore = Math.round(Math.min(100, segments.length * 11 + coverage * 55));
  let wx = 0;
  let wy = 0;
  let wsum = 0;
  for (const g of segments) {
    const w = g.bbox.w * g.bbox.h * g.score;
    wx += (g.bbox.x + g.bbox.w / 2) * w;
    wy += (g.bbox.y + g.bbox.h / 2) * w;
    wsum += w;
  }
  return { clutterScore, coverage, focalPoint: { x: wx / wsum, y: wy / wsum } };
}

function weightedHealth(m: AsoMetrics): number {
  return Math.round(
    m.keywordOptimization * 0.25 +
      m.visualClarity * 0.25 +
      m.culturalFit * 0.15 +
      m.ctaStrength * 0.15 +
      m.metadataCompliance * 0.2,
  );
}

/* ----------------------------------- Mock ----------------------------------- */

interface ModelVerdict {
  metrics: Omit<AsoMetrics, "metadataCompliance">;
  visualCritiques: { index: number; critique: string; score: number }[];
  keywordGaps: KeywordGap[];
  weaknesses: string[];
  strengths: string[];
  recommendations: string[];
}

function mockVerdict(app: StoreListing, competitor: StoreListing | null, shots: number): ModelVerdict {
  const gaps = competitor ? keywordGapHeuristic(app, competitor) : keywordOpportunityHeuristic(app);
  const hasCta = /\b(download|start|try|join|get started|learn now)\b/i.test(`${app.summary} ${app.description}`);
  return {
    metrics: {
      keywordOptimization: Math.max(35, 88 - gaps.length * 5),
      visualClarity: 68,
      culturalFit: 62,
      ctaStrength: hasCta ? 74 : 48,
    },
    visualCritiques: Array.from({ length: shots }, (_, i) => ({
      index: i,
      critique:
        i === 0
          ? "Strong hero, but the headline competes with dense UI; lift the key value prop above the fold."
          : "Too many equal-weight elements; isolate one feature as a floating badge and darken the backdrop.",
      score: i === 0 ? 72 : 54,
    })),
    keywordGaps: gaps,
    weaknesses: [
      competitor
        ? `Short description does not mention ${gaps[0]?.keyword ?? "core use-case"} which the competitor leads with`
        : `Short description misses the high-intent term "${gaps[0]?.keyword ?? "free"}"`,
      "Screenshots rely on in-app text rather than localized marketing headlines",
      hasCta ? "CTA appears only deep in the full description" : "No clear call-to-action in the short description",
    ],
    strengths: [`High rating (${app.score.toFixed(1)}) and strong install base`, "Title already contains the primary category keyword"],
    recommendations: [
      `Add "${gaps[0]?.keyword ?? "learn"}" and "${gaps[1]?.keyword ?? "free"}" to the short description`,
      "Regenerate screenshot 2 as a poster with one floating UI badge and a localized headline",
      "Localize title and short description for ja-JP, id-ID and es-ES to capture non-English demand",
    ],
  };
}

/* ----------------------------------- Audit ----------------------------------- */

export async function auditListing(
  app: StoreListing,
  competitor: StoreListing | null,
  opts: { screenshots?: number } = {},
): Promise<AsoAnalysis> {
  const status = providerStatus();
  const warnings: string[] = [];
  const shotCount = Math.min(opts.screenshots ?? 2, app.screenshots.length);

  // 1. Screenshots → data URLs (needed for both the vision model and the studio hand-off)
  const shots = await Promise.all(
    app.screenshots.slice(0, shotCount).map(async (url) => {
      try {
        return await toDataUrl(url);
      } catch (err) {
        warnings.push(`Screenshot download failed: ${(err as Error).message}`);
        return "";
      }
    }),
  );

  // 2. Visual teardown via the segmentation provider
  const segProvider = getSegmentProvider();
  const segmentsPerShot: Segment[][] = await Promise.all(
    shots.map(async (dataUrl, i) => {
      if (segProvider.name === "mock" || !dataUrl) return mockSegments(i);
      try {
        const boxes = await segProvider.segment({ imageDataUrl: dataUrl, prompts: [...UI_SEGMENT_PROMPTS, "text"], hint: i });
        const refined = refineDetections(boxes, i, 8);
        if (!refined.length) warnings.push(`${segProvider.model}: no UI regions found in screenshot ${i + 1}; simulated regions shown.`);
        return refined.length ? refined : mockSegments(i);
      } catch (err) {
        warnings.push(`${segProvider.model} (screenshot ${i + 1}): ${(err as Error).message} (used simulated output)`);
        return mockSegments(i);
      }
    }),
  );

  // 3. Deterministic compliance
  const compliance = checkCompliance(app);
  const metadataCompliance = Math.round((compliance.filter((c) => c.ok).length / compliance.length) * 100);

  // 4. Model verdict (scores, critique, keyword gaps)
  const textProvider = getTextProvider();
  let verdict: ModelVerdict;
  if (textProvider.name === "mock") {
    verdict = mockVerdict(app, competitor, shots.length);
  } else {
    try {
      const system = `You are a senior App Store Optimization (ASO) analyst. ${
        competitor
          ? "Compare OUR Google Play listing with a COMPETITOR"
          : "Audit OUR Google Play listing against best practice for its category"
      } and return ONLY JSON:
{
  "metrics": { "keywordOptimization": 0-100, "visualClarity": 0-100, "culturalFit": 0-100, "ctaStrength": 0-100 },
  "visualCritiques": [ { "index": number, "critique": string (<= 2 sentences, concrete), "score": 0-100 } ], // one per attached screenshot, in order
  "keywordGaps": [ { "keyword": string, "competitorCount": number, "difficulty": 1-100, "relevance": 1-100, "placement": "title"|"short"|"full" } ], // 6-10 ${
        competitor
          ? "high-intent keywords the competitor uses that we do not"
          : "high-intent keywords people search for in this category that our listing never uses; set competitorCount to 0"
      }
  "weaknesses": string[],      // 3-5 specific, fixable weaknesses of OUR listing
  "strengths": string[],       // 2-3
  "recommendations": string[]  // 3-5 actionable fixes, most impactful first
}
Visual clarity must consider the detected UI regions per screenshot (count and coverage are given). Be critical and specific.`;
      const user = `OUR APP (${app.appId})
Title: ${app.title}
Short: ${app.summary}
Rating: ${app.score} (${app.ratings} ratings), installs ${app.installs}
Full description:
${app.description.slice(0, 3500)}

${
        competitor
          ? `COMPETITOR (${competitor.appId})
Title: ${competitor.title}
Short: ${competitor.summary}
Rating: ${competitor.score} (${competitor.ratings} ratings), installs ${competitor.installs}
Full description:
${competitor.description.slice(0, 3500)}
`
          : `CATEGORY: ${app.genre || "unknown"} (no competitor given; judge against strong listings in this category)
`
      }
DETECTED UI REGIONS (segmentation provider ${segProvider.model}):
${segmentsPerShot.map((s, i) => `screenshot ${i + 1}: ${s.length} regions, coverage ${(visualStats(s).coverage * 100).toFixed(0)}%, labels ${s.map((g) => g.label).join(", ")}`).join("\n")}

${
        competitor
          ? `Heuristic keyword gaps for reference: ${keywordGapHeuristic(app, competitor)
              .map((g) => g.keyword)
              .join(", ")}`
          : "Infer the keyword opportunities from what this app does and how people search its category. Never suggest a term that does not fit this specific app."
      }`;
      verdict = await textProvider.chatJson<ModelVerdict>({
        system,
        user,
        images: shots.filter(Boolean),
        temperature: 0.4,
      });
      verdict.keywordGaps = (verdict.keywordGaps ?? []).slice(0, 10);
      verdict.visualCritiques = verdict.visualCritiques ?? [];
    } catch (err) {
      warnings.push(`${textProvider.model}: ${(err as Error).message} (used simulated analysis)`);
      verdict = mockVerdict(app, competitor, shots.length);
    }
  }

  const clamp = (n: unknown, d = 50) => (typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : d);
  const metrics: AsoMetrics = {
    keywordOptimization: clamp(verdict.metrics?.keywordOptimization),
    visualClarity: clamp(verdict.metrics?.visualClarity),
    culturalFit: clamp(verdict.metrics?.culturalFit),
    ctaStrength: clamp(verdict.metrics?.ctaStrength),
    metadataCompliance,
  };

  // Models sometimes number screenshots from 1; normalise to 0-based before matching.
  const critiques = verdict.visualCritiques.map((c) => ({ ...c, index: Number(c.index) }));
  const oneBased = critiques.length > 0 && critiques.every((c) => c.index >= 1) && !critiques.some((c) => c.index === 0);
  if (oneBased) critiques.forEach((c) => (c.index -= 1));

  const visual: VisualAudit[] = shots.map((dataUrl, i) => {
    const segments = segmentsPerShot[i];
    const stats = visualStats(segments);
    const crit = critiques.find((c) => c.index === i) ?? critiques[i];
    return {
      index: i,
      screenshotUrl: app.screenshots[i],
      screenshotDataUrl: dataUrl,
      segments,
      ...stats,
      critique: crit?.critique ?? "No critique available.",
      score: clamp(crit?.score, Math.max(20, 100 - stats.clutterScore)),
    };
  });

  const weakScreenshots = [...visual].sort((a, b) => a.score - b.score).slice(0, 1).map((v) => v.index);

  return {
    app,
    competitor,
    healthScore: weightedHealth(metrics),
    metrics,
    compliance,
    visual,
    keywordGaps: verdict.keywordGaps,
    weaknesses: verdict.weaknesses ?? [],
    strengths: verdict.strengths ?? [],
    recommendations: verdict.recommendations ?? [],
    weakScreenshots,
    mode: status.mode,
    warnings,
    generatedAt: new Date().toISOString(),
  };
}
