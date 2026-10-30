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

/** Rubric anchors so scores mean the same thing on every run. */
export const SCORE_RUBRIC = `Score every metric and screenshot against these anchors:
90-100: meets every rule, nothing worth changing.
75-89: meets the rules with one minor issue.
55-74: breaks one rule clearly.
35-54: breaks two or more rules.
0-34: missing or unusable.`;

export function rulesBlock(): string {
  return SCREENSHOT_RULES.map((r, i) => `${i + 1}. ${r}`).join("\n");
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
