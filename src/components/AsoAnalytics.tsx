"use client";

import { useState } from "react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  MarkedList,
  Meter,
  Notice,
  ScoreDial,
  Stat,
  Table,
  Tag,
  TextButton,
  Working,
  scoreTone,
} from "@/components/ui";
import type { AsoAnalysis, VisualAudit } from "@/lib/aso-analytics";
import type { AuditBaseline } from "@/lib/audit-baseline";
import { PLAY_LIMITS } from "@/lib/types";

interface Props {
  analysis: AsoAnalysis | null;
  loading: boolean;
  error: string | null;
  onAnalyze: (input: { appId: string; competitorAppId: string; demo?: boolean }) => void;
  onFixAndLocalize: () => void;
  /** The audit the owner fixed from, when this app was audited and fixed before. */
  baseline: AuditBaseline | null;
  onClearBaseline: () => void;
}

const METRICS: { key: keyof AsoAnalysis["metrics"]; label: string; source: string }[] = [
  { key: "keywordOptimization", label: "Keywords", source: "Muse Spark" },
  { key: "visualClarity", label: "Visual clarity", source: "SAM 3.1" },
  { key: "culturalFit", label: "Cultural fit", source: "Muse Spark" },
  { key: "ctaStrength", label: "Call to action", source: "Muse Spark" },
  { key: "metadataCompliance", label: "Play limits", source: "Rules" },
];

const AUDIT_OUTPUTS = [
  {
    title: "A health score",
    body: "Five measures from 0 to 100: keywords, visual clarity, cultural fit, call to action and Play limits.",
  },
  {
    title: "A screenshot teardown",
    body: "SAM 3.1 outlines each screenshot, rates how busy it is and shows where the eye lands first.",
  },
  {
    title: "The keywords you are missing",
    body: "Terms your competitor uses that you do not, or high-intent terms for your category if you skip the competitor.",
  },
];

const COMPLIANCE_LABEL = { title: "Title", shortDescription: "Short description", fullDescription: "Full description" } as const;

const PLACEMENT_LABEL = {
  title: `Title, ${PLAY_LIMITS.title} chars`,
  short: `Short description, ${PLAY_LIMITS.shortDescription} chars`,
  full: "Full description",
} as const;

function verdictLine(score: number): string {
  if (score >= 85) return "Strong listing. Localize to grow further.";
  if (score >= 70) return "Solid, with clear gaps left to close.";
  if (score >= 50) return "Average. Keywords and visuals both need work.";
  return "Weak listing. Start with the fixes below.";
}

export function AsoAnalytics({ analysis, loading, error, onAnalyze, onFixAndLocalize, baseline, onClearBaseline }: Props) {
  const [appId, setAppId] = useState("");
  const [competitorId, setCompetitorId] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (appId.trim()) onAnalyze({ appId, competitorAppId: competitorId });
  };

  return (
    <div className="flex flex-col gap-4 lg:h-full lg:min-h-0">
      <Card>
        <CardHeader
          title="Audit your listing"
          description="We pull the Google Play listing and score it. Add a competitor to see which keywords it wins on."
          actions={
            <TextButton disabled={loading} onClick={() => onAnalyze({ appId, competitorAppId: competitorId, demo: true })}>
              Try the demo with sample apps
            </TextButton>
          }
        />
        <CardBody>
          <form onSubmit={submit} className="grid items-end gap-4 md:grid-cols-[1fr_1fr_auto]">
            <Field label="Your app" htmlFor="audit-app">
              <Input
                id="audit-app"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="com.yourcompany.app or a Play Store link"
              />
            </Field>
            <Field label="Competitor" htmlFor="audit-competitor" aside="Optional">
              <Input
                id="audit-competitor"
                value={competitorId}
                onChange={(e) => setCompetitorId(e.target.value)}
                placeholder="com.competitor.app"
              />
            </Field>
            <Button type="submit" variant="primary" loading={loading} disabled={!appId.trim()}>
              {loading ? "Auditing" : "Run audit"}
            </Button>
          </form>
          {error && (
            <Notice tone="bad" title="The audit could not run" className="mt-4">
              {error}
            </Notice>
          )}
          {!analysis && !loading && (
            <div className="mt-6 grid gap-x-8 gap-y-5 border-t border-line pt-6 md:grid-cols-3">
              {AUDIT_OUTPUTS.map((o) => (
                <div key={o.title}>
                  <p className="font-display text-[17px] leading-snug">{o.title}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">{o.body}</p>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
      {loading && (
        <Card className="flex-1">
          <Working>Reading the Play Store listing, outlining screenshot regions and scoring the copy.</Working>
        </Card>
      )}

      {analysis && !loading && (
        <div className="space-y-4 pb-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
          {analysis.warnings.length > 0 && (
            <Notice tone="warn" title="Part of this audit used simulated output">
              <ul className="list-disc space-y-0.5 pl-4">
                {analysis.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </Notice>
          )}

          {baseline && <SinceLastFix analysis={analysis} baseline={baseline} onClear={onClearBaseline} />}

          {/* Verdict */}
          <Card>
            <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              <div className="flex min-w-0 flex-col gap-6 p-5 sm:p-6">
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5">
                  <ScoreDial score={analysis.healthScore} label={`ASO health ${analysis.healthScore} of 100`} />
                  <div className="w-full min-w-0">
                    <p className="text-xs text-muted">ASO health, out of 100</p>
                    <h3 className="mt-1 font-display text-[22px] leading-[1.15] sm:text-[26px]">{verdictLine(analysis.healthScore)}</h3>
                  </div>
                </div>
                <p className="text-[13px] leading-relaxed text-muted">
                  <AppName listing={analysis.app} />
                  {analysis.competitor ? (
                    <>
                      {" "}compared with <AppName listing={analysis.competitor} />.
                    </>
                  ) : (
                    " scored against strong listings in its category."
                  )}
                </p>
                <dl className="grid grid-cols-3 gap-4 border-t border-line pt-5">
                  {analysis.compliance.map((c) => (
                    <Stat
                      key={c.field}
                      label={COMPLIANCE_LABEL[c.field]}
                      tone={c.ok ? undefined : "bad"}
                      value={
                        <>
                          {c.length}
                          <span className="text-faint">/{c.limit}</span>
                        </>
                      }
                    />
                  ))}
                </dl>
              </div>
              <div className="flex min-w-0 flex-col border-t border-line lg:border-l lg:border-t-0">
                <div className="h-[230px] px-2 pt-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={METRICS.map((m) => ({ metric: m.label, score: analysis.metrics[m.key] }))} outerRadius="68%">
                      <PolarGrid stroke="var(--line)" />
                      <PolarAngleAxis dataKey="metric" tick={{ fill: "var(--muted)", fontSize: 11 }} />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar dataKey="score" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.14} strokeWidth={1.5} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <ul className="grid grid-cols-1 gap-x-6 px-5 pb-5 sm:grid-cols-2 sm:px-6">
                  {METRICS.map((m) => (
                    <li key={m.key} className="flex items-center justify-between gap-3 border-t border-line py-2 text-[13px]">
                      <span>
                        {m.label} <span className="text-xs text-faint">{m.source}</span>
                      </span>
                      <Tag tone={scoreTone(analysis.metrics[m.key])}>{analysis.metrics[m.key]}</Tag>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          {/* Findings */}
          <Card>
            <CardHeader
              title="What to fix first"
              description="Muse Spark's read of the listing, most important first."
              actions={
                <Button variant="primary" size="sm" onClick={onFixAndLocalize}>
                  Fix and localize
                </Button>
              }
            />
            <CardBody className="grid gap-8 md:grid-cols-3">
              {analysis.weaknesses.length ? (
                <FindingGroup title="Weaknesses" tone="bad" items={analysis.weaknesses} />
              ) : (
                <div>
                  <p className="mb-3 text-[13px] font-medium text-ink">Weaknesses</p>
                  <p className="text-[13px] leading-relaxed text-muted">None found. Every screenshot and text rule is met.</p>
                </div>
              )}
              <FindingGroup title="Recommendations" tone="accent" items={analysis.recommendations} />
              <FindingGroup title="Strengths" tone="ok" items={analysis.strengths} />
            </CardBody>
          </Card>

          {/* Visual teardown */}
          <Card>
            <CardHeader
              title="Screenshot teardown"
              description="Regions found by SAM 3.1, how busy each screenshot is, and where the eye lands."
            />
            <CardBody className="grid gap-4 md:grid-cols-2">
              {analysis.visual.map((v) => (
                <TeardownCard key={v.index} audit={v} weak={analysis.weakScreenshots.includes(v.index)} />
              ))}
            </CardBody>
          </Card>

          {/* Keywords */}
          <Card>
            <CardHeader
              title={analysis.competitor ? "Keyword gap" : "Keyword opportunities"}
              description={
                analysis.competitor
                  ? `Terms ${analysis.competitor.title} uses that your listing does not.`
                  : "High-intent terms for your category that your listing never uses."
              }
            />
            <div className="pb-3">
              <Table>
                <thead>
                  <tr>
                    <th>Keyword</th>
                    {analysis.competitor && <th>Competitor uses</th>}
                    <th>Difficulty</th>
                    <th>Relevance</th>
                    <th>Where to add it</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.keywordGaps.map((g) => (
                    <tr key={g.keyword}>
                      <td className="font-medium">{g.keyword}</td>
                      {analysis.competitor && <td className="font-mono text-xs text-muted">{g.competitorCount} times</td>}
                      <td>
                        <Meter value={g.difficulty} invert />
                      </td>
                      <td>
                        <Meter value={g.relevance} />
                      </td>
                      <td className="text-muted">{PLACEMENT_LABEL[g.placement] ?? g.placement}</td>
                    </tr>
                  ))}
                  {analysis.keywordGaps.length === 0 && (
                    <tr>
                      <td colSpan={analysis.competitor ? 5 : 4} className="py-8 text-center text-muted">
                        No missing keywords found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Pieces ------------------------------- */

function Delta({ value }: { value: number }) {
  if (value === 0) return <Tag>no change</Tag>;
  return <Tag tone={value > 0 ? "ok" : "bad"}>{value > 0 ? `+${value}` : value}</Tag>;
}

/** Before and after, against the audit the owner last fixed from. */
function SinceLastFix({ analysis, baseline, onClear }: { analysis: AsoAnalysis; baseline: AuditBaseline; onClear: () => void }) {
  const date = new Date(baseline.auditedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  const health = analysis.healthScore - baseline.healthScore;
  return (
    <Card>
      <CardHeader
        title="Since your last fix"
        description={`Compared with the audit from ${date} that you fixed from. Both use the same rubric; a change of a few points can be noise.`}
        actions={
          <TextButton className="text-xs" onClick={onClear}>
            Stop comparing
          </TextButton>
        }
      />
      <CardBody className="grid gap-8 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <p className="text-xs text-muted">ASO health</p>
          <p className="mt-1 flex items-center gap-3 font-display text-[26px] leading-none">
            <span className="text-muted">{baseline.healthScore}</span>
            <span className="text-faint">→</span>
            <span>{analysis.healthScore}</span>
            <Delta value={health} />
          </p>
        </div>
        <ul>
          {METRICS.map((m) => (
            <li key={m.key} className="flex items-center justify-between gap-3 border-t border-line py-2 text-[13px] first:border-t-0 first:pt-0">
              <span>{m.label}</span>
              <span className="flex items-center gap-2 font-mono text-xs text-muted">
                {baseline.metrics[m.key]} → {analysis.metrics[m.key]}
                <Delta value={analysis.metrics[m.key] - baseline.metrics[m.key]} />
              </span>
            </li>
          ))}
        </ul>
        <div>
          <p className="mb-3 text-[13px] font-medium text-ink">Fixed since then</p>
          {analysis.resolved.length ? (
            <MarkedList tone="ok" items={analysis.resolved} />
          ) : (
            <p className="text-[13px] leading-relaxed text-muted">None of the earlier weaknesses is resolved yet.</p>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function AppName({ listing }: { listing: NonNullable<AsoAnalysis["competitor"]> }) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {listing.icon && <img src={listing.icon} alt="" className="h-4 w-4 translate-y-[3px] rounded" />}
      <span className="font-medium text-ink">{listing.title}</span>
      <span className="font-mono text-xs">{listing.score.toFixed(1)} rating</span>
      {listing.source === "sample" && <Tag>sample app</Tag>}
    </span>
  );
}

function FindingGroup({ title, items, tone }: { title: string; items: string[]; tone: "bad" | "ok" | "accent" }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-3 text-[13px] font-medium text-ink">{title}</p>
      <MarkedList tone={tone} items={items} />
    </div>
  );
}

function TeardownCard({ audit, weak }: { audit: VisualAudit; weak: boolean }) {
  const [showHeat, setShowHeat] = useState(true);
  return (
    <div className="flex flex-col gap-4 rounded-lg bg-sunken p-4 sm:flex-row sm:gap-5">
      <div className="relative mx-auto w-[160px] shrink-0 overflow-hidden rounded-md bg-ink/90 sm:mx-0 sm:w-[140px]" style={{ aspectRatio: "9 / 16" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={audit.screenshotDataUrl || audit.screenshotUrl} alt={`Screenshot ${audit.index + 1}`} className="h-full w-full object-cover" />
        {showHeat && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(circle at ${audit.focalPoint.x * 100}% ${audit.focalPoint.y * 100}%, rgba(179,38,30,0.45) 0%, rgba(154,106,15,0.28) 22%, rgba(31,63,191,0.1) 45%, transparent 65%)`,
              mixBlendMode: "multiply",
            }}
          />
        )}
        {audit.segments.map((s) => (
          <div
            key={s.id}
            className="absolute rounded-[3px] shadow-[0_0_0_1.5px_rgba(255,255,255,0.9),0_0_0_2.5px_rgba(31,63,191,0.8)]"
            style={{
              left: `${s.bbox.x * 100}%`,
              top: `${s.bbox.y * 100}%`,
              width: `${s.bbox.w * 100}%`,
              height: `${s.bbox.h * 100}%`,
            }}
          />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] font-medium">Screenshot {audit.index + 1}</p>
          {weak && <Tag tone="bad">Weakest</Tag>}
        </div>
        <dl className="grid grid-cols-3 gap-3">
          <Stat label="Visual score" value={audit.score} tone={scoreTone(audit.score)} />
          <Stat label="Clutter" value={audit.clutterScore} tone={audit.clutterScore > 60 ? "bad" : audit.clutterScore > 35 ? "warn" : "ok"} />
          <Stat label="Regions" value={audit.segments.length} />
        </dl>
        <p className="text-[13px] leading-relaxed text-ink">{audit.critique}</p>
        <div className="mt-auto flex items-center justify-between gap-3 text-xs text-muted">
          <span>Regions cover {Math.round(audit.coverage * 100)}% of the screen.</span>
          <TextButton className="text-xs" onClick={() => setShowHeat((v) => !v)}>
            {showHeat ? "Hide heatmap" : "Show heatmap"}
          </TextButton>
        </div>
      </div>
    </div>
  );
}
