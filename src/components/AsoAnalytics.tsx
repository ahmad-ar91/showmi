"use client";

import { useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Crosshair,
  Loader2,
  Search,
  Sparkles,
  Wand2,
  XCircle,
} from "lucide-react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import type { AsoAnalysis, VisualAudit } from "@/lib/aso-analytics";
import { PLAY_LIMITS } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  analysis: AsoAnalysis | null;
  loading: boolean;
  error: string | null;
  onAnalyze: (input: { appId: string; competitorAppId: string; demo?: boolean }) => void;
  onFixAndLocalize: () => void;
}

const METRIC_LABELS: { key: keyof AsoAnalysis["metrics"]; label: string; hint: string }[] = [
  { key: "keywordOptimization", label: "Keyword Optimization", hint: "Muse Spark" },
  { key: "visualClarity", label: "Visual Clarity", hint: "SAM 3.1" },
  { key: "culturalFit", label: "Cultural Fit", hint: "Muse Spark" },
  { key: "ctaStrength", label: "CTA Strength", hint: "Muse Spark" },
  { key: "metadataCompliance", label: "Metadata Compliance", hint: "Play limits" },
];

const COMPLIANCE_LABEL = { title: "Title", shortDescription: "Short description", fullDescription: "Full description" } as const;

function verdictLine(score: number): string {
  if (score >= 85) return "Strong listing. Localize to grow further.";
  if (score >= 70) return "Solid, with clear gaps a competitor is exploiting.";
  if (score >= 50) return "Average. Keywords and visuals both need work.";
  return "Weak listing. Start with the fixes below.";
}

function scoreTone(n: number): "success" | "warning" | "danger" {
  return n >= 75 ? "success" : n >= 50 ? "warning" : "danger";
}

export function AsoAnalytics({ analysis, loading, error, onAnalyze, onFixAndLocalize }: Props) {
  const [appId, setAppId] = useState("");
  const [competitorId, setCompetitorId] = useState("");

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* Inputs */}
      <Panel>
        <PanelHeader
          icon={<Search size={16} />}
          title="Audit your listing against a competitor"
          subtitle="Pulls both Google Play listings, then scores them with SAM 3.1 and Muse Spark"
          right={
            <Button variant="primary" size="sm" disabled={loading} onClick={() => onAnalyze({ appId, competitorAppId: competitorId, demo: true })}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Load demo: Ritmova vs Paceto
            </Button>
          }
        />
        <div className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_auto]">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-muted">Your app (Play Store ID or URL)</span>
            <input
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              placeholder="com.example.ritmova or https://play.google.com/store/apps/details?id=…"
              className="h-10 w-full rounded-lg border border-line bg-sunken px-3 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-muted">Competitor (Play Store ID or URL)</span>
            <input
              value={competitorId}
              onChange={(e) => setCompetitorId(e.target.value)}
              placeholder="com.example.paceto"
              className="h-10 w-full rounded-lg border border-line bg-sunken px-3 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </label>
          <div className="flex items-end">
            <Button
              size="md"
              className="w-full md:w-auto"
              disabled={loading || !appId.trim() || !competitorId.trim()}
              onClick={() => onAnalyze({ appId, competitorAppId: competitorId })}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <BarChart3 size={14} />}
              Analyze
            </Button>
          </div>
        </div>
        {error && <p className="border-t border-bad/30 bg-bad-soft px-4 py-2 text-xs text-bad">{error}</p>}
      </Panel>

      {/* Dashboard */}
      {!analysis && !loading && (
        <Panel className="flex-1">
          <div className="flex h-full flex-col items-center justify-center p-10 text-center">
            <BarChart3 size={26} className="mb-3 text-faint" />
            <p className="font-display text-lg text-ink">Start with an audit</p>
            <p className="mt-1 max-w-md text-xs text-muted">
              Enter your Play Store app and a competitor, or load the demo, to get an ASO health score, a screenshot
              teardown and the keyword gap.
            </p>
          </div>
        </Panel>
      )}
      {loading && (
        <Panel className="flex-1">
          <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center text-sm text-muted">
            <Loader2 size={28} className="animate-spin text-accent" />
            <p>Scraping Google Play, segmenting screenshots with SAM 3.1 and scoring with Muse Spark…</p>
          </div>
        </Panel>
      )}
      {analysis && !loading && (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {analysis.warnings.length > 0 && (
            <div className="rounded-lg border border-warn/30 bg-warn-soft p-3 text-xs text-warn">
              <ul className="list-disc space-y-0.5 pl-4">
                {analysis.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Verdict: the listing as the hero, its score, the competitor, the five metrics */}
          <Panel>
            <div className="grid gap-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              <div className="flex flex-col gap-5 p-5 lg:border-r lg:border-line">
                <div className="flex items-start gap-4">
                  <ScoreRing score={analysis.healthScore} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted">ASO health, out of 100</p>
                    <h3 className="font-display text-2xl leading-tight">{verdictLine(analysis.healthScore)}</h3>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <AppChip listing={analysis.app} />
                      <span>against</span>
                      <AppChip listing={analysis.competitor} />
                    </div>
                  </div>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-xs">
                  {analysis.compliance.map((c) => (
                    <div key={c.field} className="rounded-md border border-line px-3 py-2">
                      <dt className="text-muted">{COMPLIANCE_LABEL[c.field]}</dt>
                      <dd className={cn("mt-0.5 flex items-center gap-1 font-mono text-sm", c.ok ? "text-ok" : "text-bad")}>
                        {c.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                        {c.length}
                        <span className="text-faint">/{c.limit}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="flex flex-col">
                <div className="h-[230px] px-2 pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart
                      data={METRIC_LABELS.map((m) => ({ metric: m.label, score: analysis.metrics[m.key] }))}
                      outerRadius="70%"
                    >
                      <PolarGrid stroke="var(--line)" />
                      <PolarAngleAxis dataKey="metric" tick={{ fill: "var(--muted)", fontSize: 11 }} />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar dataKey="score" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.18} strokeWidth={1.5} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <ul className="grid grid-cols-1 gap-x-4 border-t border-line px-4 py-3 text-xs sm:grid-cols-2">
                  {METRIC_LABELS.map((m) => (
                    <li key={m.key} className="flex items-center justify-between border-b border-line/70 py-1.5">
                      <span className="text-ink">
                        {m.label} <span className="text-faint">({m.hint})</span>
                      </span>
                      <span
                        className={cn(
                          "font-mono",
                          analysis.metrics[m.key] >= 75 ? "text-ok" : analysis.metrics[m.key] >= 50 ? "text-warn" : "text-bad",
                        )}
                      >
                        {analysis.metrics[m.key]}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Panel>

          {/* Findings */}
          <Panel>
            <PanelHeader
              icon={<AlertTriangle size={16} />}
              title="Findings"
              subtitle="What Muse Spark would change first"
              right={
                <Button variant="primary" size="sm" onClick={onFixAndLocalize}>
                  <Wand2 size={14} /> Fix and localize
                </Button>
              }
            />
            <div className="grid gap-5 p-4 text-xs md:grid-cols-3">
              <FindingList title="Weaknesses" tone="danger" items={analysis.weaknesses} />
              <FindingList title="Strengths" tone="success" items={analysis.strengths} />
              <FindingList title="Recommendations" tone="accent" items={analysis.recommendations} />
            </div>
          </Panel>

          {/* Visual teardown */}
          <Panel>
            <PanelHeader
              icon={<Crosshair size={16} />}
              title="Screenshot teardown"
              subtitle="SAM 3.1 regions, clutter score, focal-point heatmap and a critique per screenshot"
            />
            <div className="grid gap-4 p-4 md:grid-cols-2">
              {analysis.visual.map((v) => (
                <TeardownCard key={v.index} audit={v} weak={analysis.weakScreenshots.includes(v.index)} />
              ))}
            </div>
          </Panel>

          {/* Keyword gap */}
          <Panel>
            <PanelHeader
              icon={<Search size={16} />}
              title="Keyword gap"
              subtitle={`Terms ${analysis.competitor.title} ranks on that are missing from your listing`}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-line text-[10px] text-muted">
                  <tr>
                    <th className="px-4 py-2 font-medium">Keyword</th>
                    <th className="px-4 py-2 font-medium">Competitor uses</th>
                    <th className="px-4 py-2 font-medium">Difficulty</th>
                    <th className="px-4 py-2 font-medium">Relevance</th>
                    <th className="px-4 py-2 font-medium">Where to add it</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.keywordGaps.map((g) => (
                    <tr key={g.keyword} className="border-b border-line hover:bg-sunken">
                      <td className="px-4 py-2 font-medium text-ink">{g.keyword}</td>
                      <td className="px-4 py-2 text-muted">{g.competitorCount}×</td>
                      <td className="px-4 py-2">
                        <Meter value={g.difficulty} invert />
                      </td>
                      <td className="px-4 py-2">
                        <Meter value={g.relevance} />
                      </td>
                      <td className="px-4 py-2">
                        <Badge tone="neutral">
                          {g.placement === "title"
                            ? `Title (≤${PLAY_LIMITS.title})`
                            : g.placement === "short"
                              ? `Short desc (≤${PLAY_LIMITS.shortDescription})`
                              : "Full description"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {analysis.keywordGaps.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted">
                        No keyword gap found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Sub-components ------------------------------- */

function ScoreRing({ score }: { score: number }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const color = score >= 75 ? "var(--ok)" : score >= 50 ? "var(--warn)" : "var(--bad)";
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={r} stroke="var(--line)" strokeWidth="8" fill="none" />
        <circle
          cx="64"
          cy="64"
          r={r}
          stroke={color}
          strokeWidth="8"
          fill="none"
          strokeLinecap="butt"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-4xl leading-none tabular-nums">{score}</span>
      </div>
    </div>
  );
}

function AppChip({ listing }: { listing: AsoAnalysis["app"] }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-line bg-sunken px-2 py-0.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {listing.icon && <img src={listing.icon} alt="" className="h-4 w-4 rounded" />}
      <span className="max-w-[110px] truncate text-ink">{listing.title}</span>
      <span className="text-warn">★ {listing.score.toFixed(1)}</span>
      {listing.source === "snapshot" && <Badge tone="warning">snapshot</Badge>}
    </span>
  );
}

function FindingList({ title, items, tone }: { title: string; items: string[]; tone: "danger" | "success" | "accent" }) {
  if (!items.length) return null;
  const dot = { danger: "bg-bad", success: "bg-ok", accent: "bg-accent" }[tone];
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold text-muted">{title}</p>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-ink">
            <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Meter({ value, invert = false }: { value: number; invert?: boolean }) {
  const good = invert ? value < 50 : value >= 50;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-sunken">
        <div className={cn("h-full rounded-full", good ? "bg-ok" : "bg-warn")} style={{ width: `${value}%` }} />
      </div>
      <span className="font-mono text-[11px] text-muted">{value}</span>
    </div>
  );
}

const ACCENTS = ["#1f3fbf", "#1e7a4f", "#9a6a0f", "#b3261e", "#15299a", "#17191e"];

function TeardownCard({ audit, weak }: { audit: VisualAudit; weak: boolean }) {
  const [showHeat, setShowHeat] = useState(true);
  return (
    <div className="flex gap-4 rounded-lg border border-line bg-sunken p-3">
      <div className="relative w-[150px] shrink-0 overflow-hidden rounded-lg bg-black" style={{ aspectRatio: "9 / 16" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={audit.screenshotDataUrl || audit.screenshotUrl} alt="" className="h-full w-full object-cover" />
        {showHeat && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(circle at ${audit.focalPoint.x * 100}% ${audit.focalPoint.y * 100}%, rgba(251,113,133,0.55) 0%, rgba(251,191,36,0.35) 22%, rgba(34,211,238,0.12) 45%, transparent 65%)`,
              mixBlendMode: "screen",
            }}
          />
        )}
        {audit.segments.map((s, i) => (
          <div
            key={s.id}
            title={`${s.label} ${(s.score * 100).toFixed(0)}%`}
            className="absolute rounded-sm"
            style={{
              left: `${s.bbox.x * 100}%`,
              top: `${s.bbox.y * 100}%`,
              width: `${s.bbox.w * 100}%`,
              height: `${s.bbox.h * 100}%`,
              border: `1.5px solid ${ACCENTS[i % ACCENTS.length]}`,
              boxShadow: `0 0 0 1px rgba(0,0,0,0.5)`,
            }}
          >
            <span
              className="absolute -top-2 left-0.5 rounded px-1 text-[7px] font-semibold leading-3 text-black"
              style={{ background: ACCENTS[i % ACCENTS.length] }}
            >
              {s.label}
            </span>
          </div>
        ))}
        <span className="absolute left-1 top-1 rounded bg-ink/80 px-1.5 py-0.5 text-[10px] font-medium">#{audit.index + 1}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={scoreTone(audit.score)}>Visual score {audit.score}</Badge>
          <Badge tone={audit.clutterScore > 60 ? "danger" : audit.clutterScore > 35 ? "warning" : "success"}>
            Clutter {audit.clutterScore}
          </Badge>
          <Badge tone="neutral">{audit.segments.length} UI regions</Badge>
          {weak && <Badge tone="danger">Weakest, will be regenerated</Badge>}
        </div>
        <p className="text-ink">{audit.critique}</p>
        <div className="mt-auto flex items-center justify-between text-[11px] text-muted">
          <span>
            Focal point at {Math.round(audit.focalPoint.x * 100)}%, {Math.round(audit.focalPoint.y * 100)}%. Regions cover{" "}
            {Math.round(audit.coverage * 100)}%
          </span>
          <button type="button" onClick={() => setShowHeat((v) => !v)} className="text-accent-ink hover:underline">
            {showHeat ? "Hide heatmap" : "Show heatmap"}
          </button>
        </div>
      </div>
    </div>
  );
}
