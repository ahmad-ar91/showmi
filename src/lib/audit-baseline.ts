/**
 * The audit an owner acted on ("Fix and localize"), kept in the browser so the next audit
 * of the same app can show what changed. Per-browser convenience only; never required.
 */
import type { AsoAnalysis, AsoMetrics } from "./aso-analytics";

export interface AuditBaseline {
  appId: string;
  healthScore: number;
  metrics: AsoMetrics;
  weaknesses: string[];
  visualScores: number[];
  auditedAt: string;
}

const PREFIX = "showmi.audit.baseline.";

/** Demo audits share one key; real apps use their package name. */
function keyFor(appId: string, demo: boolean): string {
  return PREFIX + (demo ? "demo" : appId);
}

/** Package name from a package name or a Play Store link (same rule as the server). */
export function appIdFromInput(input: string): string | null {
  const s = input.trim();
  const fromUrl = s.match(/[?&]id=([A-Za-z0-9._]+)/);
  if (fromUrl) return fromUrl[1];
  return /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/.test(s) ? s : null;
}

export function loadBaseline(appId: string | null, demo = false): AuditBaseline | null {
  if (!appId && !demo) return null;
  try {
    const raw = localStorage.getItem(keyFor(appId ?? "", demo));
    return raw ? (JSON.parse(raw) as AuditBaseline) : null;
  } catch {
    return null;
  }
}

export function saveBaseline(a: AsoAnalysis): void {
  const b: AuditBaseline = {
    appId: a.app.appId,
    healthScore: a.healthScore,
    metrics: a.metrics,
    weaknesses: a.weaknesses,
    visualScores: a.visual.map((v) => v.score),
    auditedAt: a.generatedAt,
  };
  try {
    localStorage.setItem(keyFor(a.app.appId, a.app.source === "sample"), JSON.stringify(b));
  } catch {
    /* storage unavailable: the comparison is simply not shown */
  }
}

export function clearBaseline(a: AsoAnalysis): void {
  try {
    localStorage.removeItem(keyFor(a.app.appId, a.app.source === "sample"));
  } catch {
    /* ignore */
  }
}
