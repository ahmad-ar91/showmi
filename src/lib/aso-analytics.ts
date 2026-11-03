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
import {
  LISTING_CHECKS,
  SHOT_CHECKS,
  checkLabel,
  checklistBlock,
  clutterFrom,
  listingMetrics,
  rulesBlock,
  shotScore,
  unionCoverage,
  type Checks,
  type ListingCheck,
  type ShotCheck,
} from "./creative-rules";
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
  /** Yes/no rule checks the score is computed from. */
  checks: Checks<ShotCheck>;
  critique: string;
  /** 0..100: 80 from the checks, 20 from region coverage and count. */
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
  /** Checks that failed in the audit the owner fixed from and pass now, as readable labels. */
  resolved: string[];
  /** Ids of the checks that failed ("listing:explicitCta", "shot0:namesFeature"); see checkLabel. */
  failedChecks: string[];
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
  if (!segments.length) return { clutterScore: 0, coverage: 0, focalPoint: { x: 0.5, y: 0.45 } };
  const coverage = unionCoverage(segments);
  const clutterScore = clutterFrom(segments.length, coverage);
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

/* ----------------------------------- Model ----------------------------------- */

interface ShotVerdict {
  index: number;
  checks: Checks<ShotCheck>;
  critique: string;
}

interface ListingVerdict {
  checks: Checks<ListingCheck>;
  keywordGaps: KeywordGap[];
  weaknesses: string[];
  strengths: string[];
  recommendations: string[];
}

function mockShots(shots: number): ShotVerdict[] {
  return Array.from({ length: shots }, (_, i) => ({
    index: i,
    checks: { namesFeature: false, proofPoint: i === 0, readable: true, calloutsClean: true },
    critique:
      i === 0
        ? "Strong hero, but the in-app greeting stands in for a headline; name the core feature above the fold."
        : "No marketing headline or proof point; isolate one feature as a callout and darken the backdrop.",
  }));
}

function mockListing(app: StoreListing, competitor: StoreListing | null): ListingVerdict {
  const gaps = competitor ? keywordGapHeuristic(app, competitor) : keywordOpportunityHeuristic(app);
  const hasCta = /\b(download|start|try|join|get started|learn now)\b/i.test(`${app.summary} ${app.description}`);
  return {
    checks: {
      titleKeyword: true,
      shortHighIntent: gaps.length < 4,
      noStuffing: true,
      fullCoversFeatures: true,
      nativeTone: true,
      marketFit: false,
      clearBenefit: true,
      explicitCta: hasCta,
      closingCta: false,
      socialProof: app.ratings > 1000,
    },
    keywordGaps: gaps,
    weaknesses: [
      competitor
        ? `Short description does not mention ${gaps[0]?.keyword ?? "core use-case"} which the competitor leads with`
        : `Short description misses the high-intent term "${gaps[0]?.keyword ?? "free"}"`,
      hasCta ? "CTA appears only deep in the full description" : "No clear call-to-action in the short description",
    ],
    strengths: [`High rating (${app.score.toFixed(1)}) and strong install base`, "Title already contains the primary category keyword"],
    recommendations: [
      `Add "${gaps[0]?.keyword ?? "learn"}" and "${gaps[1]?.keyword ?? "free"}" to the short description`,
      "Localize title and short description for ja-JP, id-ID and es-ES to capture non-English demand",
    ],
  };
}

/** Screenshots only: yes/no checks and a short critique each. Runs beside the listing call. */
async function askShots(app: StoreListing, shots: string[]): Promise<ShotVerdict[]> {
  const system = `You are a senior App Store Optimization (ASO) analyst reviewing Google Play screenshots against these rules:
${rulesBlock()}

Return ONLY JSON:
{ "screenshots": [ { "index": number, "checks": { ${Object.keys(SHOT_CHECKS)
    .map((k) => `"${k}": boolean`)
    .join(", ")} }, "critique": string } ] }
One entry per attached screenshot, in order, index starting at 0. Answer each check strictly:
${checklistBlock(SHOT_CHECKS)}
The critique is at most two concrete sentences about the failed checks, or one sentence on what works when all pass.`;
  const user = `App: ${app.title}\nWhat it does: ${app.summary}\nReview the ${shots.length} attached screenshots.`;
  const out = await getTextProvider().chatJson<{ screenshots?: ShotVerdict[] }>({
    system,
    user,
    images: shots,
    temperature: 0,
    // Yes/no answers need little reasoning; "low" roughly halves the time of a full run.
    reasoning: "low",
  });
  const list = (out.screenshots ?? []).map((s) => ({ ...s, index: Number(s.index), checks: s.checks ?? {} }));
  // Models sometimes number screenshots from 1; normalise to 0-based.
  if (list.length && list.every((s) => s.index >= 1)) list.forEach((s) => (s.index -= 1));
  return list;
}

/**
 * Checks about something being present in the copy. They pass only with a quote that really
 * occurs in our listing, which grounds the answer and keeps borderline cases from flipping.
 */
const QUOTED_CHECKS: ListingCheck[] = ["titleKeyword", "shortHighIntent", "clearBenefit", "explicitCta", "closingCta", "socialProof"];

const squash = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

function verifiedChecks(raw: Record<string, unknown> | undefined, app: StoreListing): Checks<ListingCheck> {
  const text = squash(`${app.title} ${app.summary} ${app.description}`);
  const out: Checks<ListingCheck> = {};
  for (const k of Object.keys(LISTING_CHECKS) as ListingCheck[]) {
    const v = raw?.[k];
    const answer = typeof v === "object" && v !== null ? (v as { pass?: unknown; quote?: unknown }) : { pass: v };
    if (answer.pass !== true) out[k] = false;
    else if (!QUOTED_CHECKS.includes(k)) out[k] = true;
    else {
      const quote = typeof answer.quote === "string" ? squash(answer.quote) : "";
      out[k] = quote.length > 0 && text.includes(quote);
    }
  }
  return out;
}

/** Listing text only (no images): yes/no checks, keyword gaps and findings tied to failed checks. */
async function askListing(app: StoreListing, competitor: StoreListing | null): Promise<ListingVerdict> {
  const system = `You are a senior App Store Optimization (ASO) analyst. ${
    competitor ? "Compare OUR Google Play listing with a COMPETITOR" : "Audit OUR Google Play listing against best practice for its category"
  } and return ONLY JSON:
{
  "checks": { ${(Object.keys(LISTING_CHECKS) as ListingCheck[])
    .map((k) => (QUOTED_CHECKS.includes(k) ? `"${k}": { "pass": boolean, "quote": string }` : `"${k}": { "pass": boolean }`))
    .join(", ")} },
  "keywordGaps": [ { "keyword": string, "competitorCount": number, "difficulty": 1-100, "relevance": 1-100, "placement": "title"|"short"|"full" } ], // 6-10 ${
    competitor
      ? "high-intent keywords the competitor uses that we do not"
      : "high-intent keywords people search for in this category that our listing never uses; set competitorCount to 0"
  }
  "weaknesses": string[],      // one per failed check, most costly first, at most 5; empty when every check passes
  "strengths": string[],       // 2-3
  "recommendations": string[]  // one actionable fix per weakness, same order
}
Answer each check strictly about OUR listing:
${checklistBlock(LISTING_CHECKS)}
For checks with a "quote", copy the exact words from OUR listing that satisfy it (empty when it fails); a pass without a real quote counts as a fail.
Do not invent issues beyond the failed checks and the keyword gaps.`;
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

Heuristic keyword gaps for reference: ${keywordGapHeuristic(app, competitor)
        .map((g) => g.keyword)
        .join(", ")}`
    : `CATEGORY: ${app.genre || "unknown"} (no competitor given; judge against strong listings in this category)
Infer the keyword opportunities from what this app does and how people search its category. Never suggest a term that does not fit this specific app.`
}`;
  const out = await getTextProvider().chatJson<Omit<ListingVerdict, "checks"> & { checks?: Record<string, unknown> }>({
    system,
    user,
    temperature: 0,
    reasoning: "low",
  });
  return {
    checks: verifiedChecks(out.checks, app),
    keywordGaps: (out.keywordGaps ?? []).slice(0, 10),
    weaknesses: out.weaknesses ?? [],
    strengths: out.strengths ?? [],
    recommendations: out.recommendations ?? [],
  };
}

/* ----------------------------------- Voting ----------------------------------- */

/** Asks the same question several times in parallel and keeps every answer that came back. */
async function askSeveral<T>(times: number, ask: () => Promise<T>): Promise<T[]> {
  const settled = await Promise.allSettled(Array.from({ length: times }, ask));
  const ok = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  if (!ok.length) throw (settled[0] as PromiseRejectedResult).reason;
  return ok;
}

/** Each check passes when most answers say it passes; a borderline check no longer flips between audits. */
function majority<K extends string>(answers: Checks<K>[], keys: K[]): Checks<K> {
  return Object.fromEntries(keys.map((k) => [k, answers.filter((c) => c[k] === true).length * 2 > answers.length])) as Checks<K>;
}

/** The answer that agrees with the majority on the most checks, used for its wording. */
function closest<T, K extends string>(items: T[], checksOf: (t: T) => Checks<K>, vote: Checks<K>, keys: K[]): T {
  const agree = (t: T) => keys.filter((k) => (checksOf(t)[k] === true) === vote[k]).length;
  return [...items].sort((a, b) => agree(b) - agree(a))[0];
}

function voteListing(runs: ListingVerdict[]): ListingVerdict {
  const keys = Object.keys(LISTING_CHECKS) as ListingCheck[];
  const checks = majority(runs.map((r) => r.checks), keys);
  return { ...closest(runs, (r) => r.checks, checks, keys), checks };
}

function voteShots(runs: ShotVerdict[][], shots: number): ShotVerdict[] {
  const keys = Object.keys(SHOT_CHECKS) as ShotCheck[];
  return Array.from({ length: shots }, (_, i) => {
    const answers = runs.flatMap((r) => r.filter((s) => s.index === i));
    if (!answers.length) return null;
    const checks = majority(answers.map((a) => a.checks), keys);
    return { index: i, checks, critique: closest(answers, (a) => a.checks, checks, keys).critique };
  }).filter((s): s is ShotVerdict => s !== null);
}

/* ----------------------------------- Audit ----------------------------------- */

export async function auditListing(
  app: StoreListing,
  competitor: StoreListing | null,
  opts: { screenshots?: number; previousFailedChecks?: string[] } = {},
): Promise<AsoAnalysis> {
  const status = providerStatus();
  const warnings: string[] = [];
  const wanted = opts.screenshots ?? (Number(process.env.AUDIT_SCREENSHOTS) || 4);
  const shotCount = Math.min(Math.max(1, Math.min(8, wanted)), app.screenshots.length);

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

  // 2. Segmentation, the screenshot checks and the listing checks all run at once.
  const segProvider = getSegmentProvider();
  const segmentation = Promise.all(
    shots.map(async (dataUrl, i): Promise<Segment[]> => {
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

  const textProvider = getTextProvider();
  const live = textProvider.name !== "mock";
  // Every check is asked AUDIT_VOTES times in parallel and decided by majority.
  const votes = Math.max(1, Math.min(5, Number(process.env.AUDIT_VOTES) || 3));
  const shotVerdicts = (
    live && shots.some(Boolean)
      ? askSeveral(votes, () => askShots(app, shots.filter(Boolean))).then((runs) => voteShots(runs, shots.length))
      : Promise.resolve(mockShots(shots.length))
  ).catch(
    (err) => {
      warnings.push(`${textProvider.model} (screenshots): ${(err as Error).message} (used simulated checks)`);
      return mockShots(shots.length);
    },
  );
  const listingVerdict = (
    live ? askSeveral(votes, () => askListing(app, competitor)).then(voteListing) : Promise.resolve(mockListing(app, competitor))
  ).catch((err) => {
    warnings.push(`${textProvider.model} (listing): ${(err as Error).message} (used simulated checks)`);
    return mockListing(app, competitor);
  });

  const [segmentsPerShot, shotList, listing] = await Promise.all([segmentation, shotVerdicts, listingVerdict]);

  // 3. Every score is computed here from the checks and measurements.
  const compliance = checkCompliance(app);
  const metadataCompliance = Math.round((compliance.filter((c) => c.ok).length / compliance.length) * 100);

  const visual: VisualAudit[] = shots.map((dataUrl, i) => {
    const segments = segmentsPerShot[i];
    const stats = visualStats(segments);
    const verdict = shotList.find((s) => s.index === i) ?? shotList[i];
    const checks = verdict?.checks ?? {};
    return {
      index: i,
      screenshotUrl: app.screenshots[i],
      screenshotDataUrl: dataUrl,
      segments,
      ...stats,
      checks,
      critique: verdict?.critique || "No critique available.",
      score: shotScore(checks, segments.length, stats.coverage),
    };
  });

  // Screenshot findings come from the failed screenshot checks, so they match the scores exactly.
  const shotFindings = (Object.keys(SHOT_CHECKS) as ShotCheck[]).flatMap((k) => {
    const failing = visual.filter((v) => v.checks[k] !== true).map((v) => v.index + 1);
    if (!failing.length) return [];
    const which = `${failing.length > 1 ? "Screenshots" : "Screenshot"} ${failing.join(", ")}`;
    return [{ weakness: `${which} miss the rule: ${SHOT_CHECKS[k].toLowerCase()}`, fix: `Rebuild ${which.toLowerCase()} in the studio so that ${SHOT_CHECKS[k].charAt(0).toLowerCase()}${SHOT_CHECKS[k].slice(1)}` }];
  }).slice(0, 2);
  const textCount = Math.max(0, 5 - shotFindings.length);

  const strongGaps = listing.keywordGaps.filter((g) => g.relevance >= 70).length;
  const metrics: AsoMetrics = {
    ...listingMetrics(listing.checks, strongGaps),
    visualClarity: visual.length ? Math.round(visual.reduce((s, v) => s + v.score, 0) / visual.length) : 0,
    metadataCompliance,
  };

  const failedChecks = [
    ...(Object.keys(LISTING_CHECKS) as ListingCheck[]).filter((k) => listing.checks[k] !== true).map((k) => `listing:${k}`),
    ...visual.flatMap((v) =>
      (Object.keys(SHOT_CHECKS) as ShotCheck[]).filter((k) => v.checks[k] !== true).map((k) => `shot${v.index}:${k}`),
    ),
  ];
  // A check that failed in the audit the owner fixed from and passes now.
  const failedNow = new Set(failedChecks);
  const resolved = (opts.previousFailedChecks ?? []).filter((id) => /^(listing|shot\d):\w+$/.test(id) && !failedNow.has(id)).map(checkLabel);

  // Only flag a weakest screenshot when it actually breaks a rule (below the rubric's "minor issue" band).
  const weakScreenshots = [...visual]
    .sort((a, b) => a.score - b.score)
    .slice(0, 1)
    .filter((v) => v.score < 75)
    .map((v) => v.index);
  // Only the screenshots the studio may rebuild (the three weakest) travel as data URLs;
  // the rest are shown from the Play CDN, which keeps the response well under 4.5 MB.
  const keepData = new Set([...visual].sort((a, b) => a.score - b.score).slice(0, 3).map((v) => v.index));
  for (const v of visual) if (!keepData.has(v.index)) v.screenshotDataUrl = "";

  return {
    app,
    competitor,
    healthScore: weightedHealth(metrics),
    metrics,
    compliance,
    visual,
    keywordGaps: listing.keywordGaps,
    weaknesses: [...listing.weaknesses.slice(0, textCount), ...shotFindings.map((f) => f.weakness)],
    strengths: listing.strengths,
    recommendations: [...listing.recommendations.slice(0, textCount), ...shotFindings.map((f) => f.fix)],
    failedChecks,
    resolved,
    weakScreenshots,
    mode: status.mode,
    warnings,
    generatedAt: new Date().toISOString(),
  };
}
