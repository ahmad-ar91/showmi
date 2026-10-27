"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Crosshair,
  Loader2,
  Search,
  Sparkles,
  Star,
  Wand2,
  XCircle,
} from "lucide-react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
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
          title="ASO Intelligence & Competitor Audit"
          subtitle="Pull live Google Play listings, then audit with SAM 3.1 + Muse Spark"
          right={
            <Button variant="primary" size="sm" disabled={loading} onClick={() => onAnalyze({ appId, competitorAppId: competitorId, demo: true })}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Load Demo Data (Real App vs Competitor)
            </Button>
          }
        />
        <div className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_auto]">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Your app · Play Store ID or URL</span>
            <input
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              placeholder="com.example.ritmova or https://play.google.com/store/apps/details?id=…"
              className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Competitor app ID</span>
            <input
              value={competitorId}
              onChange={(e) => setCompetitorId(e.target.value)}
              placeholder="com.example.paceto"
              className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none"
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
        {error && <p className="border-t border-rose-900/40 bg-rose-950/30 px-4 py-2 text-xs text-rose-300">{error}</p>}
      </Panel>

      {/* Dashboard */}
      {!analysis && !loading && (
        <Panel className="flex-1">
          <div className="flex h-full flex-col items-center justify-center p-10 text-center">
            <BarChart3 size={26} className="mb-3 text-zinc-600" />
            <p className="text-sm font-medium text-zinc-300">No audit yet</p>
            <p className="mt-1 max-w-md text-xs text-muted">
              Enter your Play Store app and a competitor, or load the demo (Ritmova vs Paceto) to see the ASO Health
              Score, SAM 3.1 screenshot teardown and the keyword gap table.
            </p>
          </div>
        </Panel>
      )}
      {loading && (
        <Panel className="flex-1">
          <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center text-sm text-zinc-400">
            <Loader2 size={28} className="animate-spin text-violet-400" />
            <p>Scraping Google Play, segmenting screenshots with SAM 3.1 and scoring with Muse Spark…</p>
          </div>
        </Panel>
      )}
      {analysis && !loading && (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {analysis.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              <ul className="list-disc space-y-0.5 pl-4">
                {analysis.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[320px_1fr_1fr]">
            {/* Health score */}
            <Panel>
              <PanelHeader icon={<Star size={16} />} title="Overall ASO Health" subtitle={`${analysis.app.title}`} />
              <div className="flex flex-col items-center gap-3 p-5">
                <ScoreRing score={analysis.healthScore} />
                <div className="flex items-center gap-2 text-xs text-muted">
                  <AppChip listing={analysis.app} />
                  <span>vs</span>
                  <AppChip listing={analysis.competitor} />
                </div>
                <ul className="w-full space-y-1.5 text-xs">
                  {analysis.compliance.map((c) => (
                    <li key={c.field} className="flex items-center justify-between rounded-md bg-zinc-900/70 px-2.5 py-1.5">
                      <span className="capitalize text-zinc-300">{c.field.replace(/([A-Z])/g, " $1")}</span>
                      <span className={cn("flex items-center gap-1 font-mono", c.ok ? "text-emerald-300" : "text-rose-300")}>
                        {c.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        {c.length}/{c.limit}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Panel>

            {/* Radar */}
            <Panel>
              <PanelHeader icon={<Crosshair size={16} />} title="5-Metric Radar" subtitle="0–100 per dimension" />
              <div className="h-[280px] p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    data={METRIC_LABELS.map((m) => ({ metric: m.label, score: analysis.metrics[m.key] }))}
                    outerRadius="72%"
                  >
                    <PolarGrid stroke="#3f3f46" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: "#a1a1aa", fontSize: 10 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar dataKey="score" stroke="#a78bfa" fill="#7c3aed" fillOpacity={0.45} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <ul className="grid grid-cols-1 gap-1 border-t border-panel-border p-3 text-xs sm:grid-cols-2">
                {METRIC_LABELS.map((m) => (
                  <li key={m.key} className="flex items-center justify-between rounded-md bg-zinc-900/70 px-2.5 py-1.5">
                    <span className="text-zinc-300">
                      {m.label} <span className="text-[10px] text-muted">· {m.hint}</span>
                    </span>
                    <Badge tone={scoreTone(analysis.metrics[m.key])}>{analysis.metrics[m.key]}</Badge>
                  </li>
                ))}
              </ul>
            </Panel>

            {/* Strengths / weaknesses */}
            <Panel>
              <PanelHeader
                icon={<AlertTriangle size={16} />}
                title="Findings"
                subtitle="Muse Spark verdict"
                right={
                  <Button variant="primary" size="sm" onClick={onFixAndLocalize}>
                    <Wand2 size={14} /> Fix & Localize Weaknesses <ArrowRight size={14} />
                  </Button>
                }
              />
              <PanelBody className="space-y-3 text-xs">
                <FindingList title="Weaknesses" tone="danger" items={analysis.weaknesses} />
                <FindingList title="Strengths" tone="success" items={analysis.strengths} />
                <FindingList title="Recommendations" tone="accent" items={analysis.recommendations} />
              </PanelBody>
            </Panel>
          </div>

          {/* Visual teardown */}
          <Panel>
            <PanelHeader
              icon={<Crosshair size={16} />}
              title="Visual Screenshot Teardown"
              subtitle="SAM 3.1 detections · clutter score · focal-point heatmap · Muse critique"
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
              title="Competitor Keyword Gap"
              subtitle={`Terms ${analysis.competitor.title} ranks on that are missing from your listing`}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-panel-border text-[10px] uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-2">Keyword</th>
                    <th className="px-4 py-2">Competitor uses</th>
                    <th className="px-4 py-2">Difficulty</th>
                    <th className="px-4 py-2">Relevance</th>
                    <th className="px-4 py-2">Suggested placement</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.keywordGaps.map((g) => (
                    <tr key={g.keyword} className="border-b border-zinc-800/60 hover:bg-zinc-900/60">
                      <td className="px-4 py-2 font-medium text-zinc-100">{g.keyword}</td>
                      <td className="px-4 py-2 text-zinc-400">{g.competitorCount}×</td>
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
  const color = score >= 75 ? "#34d399" : score >= 50 ? "#fbbf24" : "#fb7185";
  return (
    <div className="relative h-36 w-36">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={r} stroke="#27272a" strokeWidth="10" fill="none" />
        <circle
          cx="64"
          cy="64"
          r={r}
          stroke={color}
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums">{score}</span>
        <span className="text-[10px] uppercase tracking-wide text-muted">/ 100</span>
      </div>
    </div>
  );
}

function AppChip({ listing }: { listing: AsoAnalysis["app"] }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {listing.icon && <img src={listing.icon} alt="" className="h-4 w-4 rounded" />}
      <span className="max-w-[110px] truncate text-zinc-200">{listing.title}</span>
      <span className="text-amber-300">★ {listing.score.toFixed(1)}</span>
      {listing.source === "snapshot" && <Badge tone="warning">snapshot</Badge>}
    </span>
  );
}

function FindingList({ title, items, tone }: { title: string; items: string[]; tone: "danger" | "success" | "accent" }) {
  if (!items.length) return null;
  const dot = { danger: "bg-rose-400", success: "bg-emerald-400", accent: "bg-violet-400" }[tone];
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{title}</p>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-zinc-300">
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
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-800">
        <div className={cn("h-full rounded-full", good ? "bg-emerald-400" : "bg-amber-400")} style={{ width: `${value}%` }} />
      </div>
      <span className="font-mono text-[11px] text-zinc-400">{value}</span>
    </div>
  );
}

const ACCENTS = ["#a78bfa", "#22d3ee", "#fbbf24", "#f472b6", "#34d399", "#fb7185"];

function TeardownCard({ audit, weak }: { audit: VisualAudit; weak: boolean }) {
  const [showHeat, setShowHeat] = useState(true);
  return (
    <div className="flex gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
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
        <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium">#{audit.index + 1}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={scoreTone(audit.score)}>Visual score {audit.score}</Badge>
          <Badge tone={audit.clutterScore > 60 ? "danger" : audit.clutterScore > 35 ? "warning" : "success"}>
            Clutter {audit.clutterScore}
          </Badge>
          <Badge tone="neutral">{audit.segments.length} UI regions</Badge>
          {weak && <Badge tone="danger">Weakest · will be regenerated</Badge>}
        </div>
        <p className="text-zinc-300">{audit.critique}</p>
        <div className="mt-auto flex items-center justify-between text-[11px] text-muted">
          <span>
            Focal point {Math.round(audit.focalPoint.x * 100)}% · {Math.round(audit.focalPoint.y * 100)}% · coverage{" "}
            {Math.round(audit.coverage * 100)}%
          </span>
          <button type="button" onClick={() => setShowHeat((v) => !v)} className="text-violet-300 hover:underline">
            {showHeat ? "Hide heatmap" : "Show heatmap"}
          </button>
        </div>
      </div>
    </div>
  );
}
