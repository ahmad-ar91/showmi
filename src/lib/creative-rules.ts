/**
 * One set of screenshot rules shared by the poster generator and the audit, so ShowMi
 * never penalises posters it made by the rules it was asked to follow.
 */
import type { Segment } from "./types";

/** Floating callouts per poster. More than two reads as clutter at thumbnail size. */
export const MAX_CALLOUTS = 2;

/** Share of the frame that detected UI regions should cover (union, not sum). */
export const IDEAL_COVERAGE = { min: 0.15, max: 0.45 } as const;
/** Region count above which a screenshot starts to read as busy. */
export const BUSY_REGIONS = 5;

export const SCREENSHOT_RULES = [
  "The headline names the app's core feature or outcome for this screen (for example the calendar, the tracker, the timer), not a generic slogan.",
  "One message per screenshot; the subheadline gives one concrete proof point (a feature, a number, a result).",
  "The headline reads at thumbnail size: short, high contrast, on a calm or darkened area.",
  `At most ${MAX_CALLOUTS} floating callouts. A callout is an enlarged copy of a real UI element; that is intentional and not duplication, as long as it does not cover the headline or the main content it highlights.`,
  `Detected UI regions cover ${Math.round(IDEAL_COVERAGE.min * 100)}–${Math.round(IDEAL_COVERAGE.max * 100)}% of the frame, in at most ${BUSY_REGIONS} regions.`,
] as const;

export function rulesBlock(): string {
  return SCREENSHOT_RULES.map((r, i) => `${i + 1}. ${r}`).join("\n");
}

/* ------------------------------ Yes/no checks ------------------------------ */
/*
 * The audit asks the model only these yes/no questions and computes every score from the
 * answers. Free 0-100 scores drift between runs; a fixed checklist on an unchanged listing
 * gives the same answers, and a fixed issue shows up as a check that now passes.
 */

/** Asked once per screenshot. */
export const SHOT_CHECKS = {
  namesFeature: "The headline names the core feature or outcome this screen shows",
  proofPoint: "A subheadline or caption gives one concrete proof point",
  readable: "The headline is short, high contrast and readable at thumbnail size",
  calloutsClean: "Floating callouts, if any, are at most two and leave the headline and main content visible",
} as const;

/** Asked once for the listing text. */
export const LISTING_CHECKS = {
  titleKeyword: "The title contains the app's primary category search term",
  shortHighIntent: "The short description contains at least two high-intent search terms",
  noStuffing: "The copy has no keyword stuffing or repeated filler",
  fullCoversFeatures: "The full description covers the main features in the words people search for",
  nativeTone: "The copy reads natively for its market, with no awkward or machine-like phrasing",
  marketFit: "Examples, units and references fit the listing's market",
  clearBenefit: "The short description leads with a clear user benefit",
  explicitCta: "The short description or opening line has an explicit call to action",
  closingCta: "The full description ends with a call to action",
  socialProof: "The copy offers trust or social proof (users, ratings, awards, privacy)",
} as const;

export type ShotCheck = keyof typeof SHOT_CHECKS;
export type ListingCheck = keyof typeof LISTING_CHECKS;
export type Checks<K extends string> = Partial<Record<K, boolean>>;

/** Stable ids for failed checks ("listing:explicitCta", "shot1:namesFeature"), kept between audits. */
export function checkLabel(id: string): string {
  const [scope, key] = id.split(":");
  if (scope === "listing") return LISTING_CHECKS[key as ListingCheck] ?? key;
  const n = Number(scope.replace("shot", ""));
  return `Screenshot ${n + 1}: ${SHOT_CHECKS[key as ShotCheck] ?? key}`;
}

const share = <K extends string>(checks: Checks<K>, keys: readonly K[]) =>
  keys.filter((k) => checks[k] === true).length / keys.length;

/** 80 points from the checks, 20 from region coverage and count (measured by segmentation). */
export function shotScore(checks: Checks<ShotCheck>, regions: number, coverage: number): number {
  const outside = coverage < IDEAL_COVERAGE.min ? IDEAL_COVERAGE.min - coverage : Math.max(0, coverage - IDEAL_COVERAGE.max);
  const layout = Math.max(0, 20 - outside * 100 - Math.max(0, regions - BUSY_REGIONS) * 5);
  return Math.round(80 * share(checks, Object.keys(SHOT_CHECKS) as ShotCheck[]) + layout);
}

/** Text metrics from the listing checks; strong keyword gaps cost up to 20 keyword points. */
export function listingMetrics(checks: Checks<ListingCheck>, strongGaps: number) {
  return {
    keywordOptimization: Math.round(
      80 * share(checks, ["titleKeyword", "shortHighIntent", "noStuffing", "fullCoversFeatures"]) + Math.max(0, 20 - strongGaps * 4),
    ),
    culturalFit: Math.round(100 * share(checks, ["nativeTone", "marketFit", "noStuffing"])),
    ctaStrength: Math.round(100 * share(checks, ["clearBenefit", "explicitCta", "closingCta", "socialProof"])),
  };
}

export function checklistBlock(checks: Record<string, string>): string {
  return Object.entries(checks)
    .map(([k, v]) => `"${k}": ${v}`)
    .join("\n");
}

/** Union of the region boxes, sampled on a grid so overlapping boxes are not counted twice. */
export function unionCoverage(segments: Segment[], grid = 60): number {
  if (!segments.length) return 0;
  let hit = 0;
  for (let gy = 0; gy < grid; gy++) {
    const y = (gy + 0.5) / grid;
    for (let gx = 0; gx < grid; gx++) {
      const x = (gx + 0.5) / grid;
      if (segments.some((s) => x >= s.bbox.x && x <= s.bbox.x + s.bbox.w && y >= s.bbox.y && y <= s.bbox.y + s.bbox.h)) hit++;
    }
  }
  return hit / (grid * grid);
}

/**
 * 0 = calm, 100 = very busy. Inside the ideal band with few regions stays below 35;
 * every region past BUSY_REGIONS and every point of coverage above the band adds to it.
 * A sparse screenshot is not cluttered, so low coverage does not raise it.
 */
export function clutterFrom(regions: number, coverage: number): number {
  const extraRegions = Math.max(0, regions - BUSY_REGIONS) * 10;
  const over = Math.max(0, coverage - IDEAL_COVERAGE.max) * 160;
  return Math.round(Math.min(100, coverage * 40 + Math.min(regions, BUSY_REGIONS) * 3 + extraRegions + over));
}
