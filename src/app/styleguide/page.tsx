"use client";

import { useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CheckRow,
  CopyButton,
  Counter,
  Divider,
  EmptyState,
  Field,
  Input,
  MarkedList,
  Meter,
  Notice,
  ScoreDial,
  SegmentedControl,
  Select,
  Spinner,
  Stat,
  Table,
  Tabs,
  Tag,
  Textarea,
  TextButton,
  Well,
  Working,
} from "@/components/ui";
import { BRAND } from "@/lib/brand";

const COLORS = [
  { token: "paper", use: "App background" },
  { token: "panel", use: "Card surface" },
  { token: "sunken", use: "Wells, hover rows" },
  { token: "line", use: "Borders, dividers" },
  { token: "ink", use: "Text, strong UI" },
  { token: "muted", use: "Secondary text" },
  { token: "accent", use: "Primary action, focus" },
  { token: "ok", use: "Passing, within limit" },
  { token: "warn", use: "Needs attention" },
  { token: "bad", use: "Failing, over limit" },
];

const RULES = [
  "No decorative icons. Actions are verbs, statuses are words, tone is colour.",
  "One Card level. Inside a card, group with spacing, Well or Divider.",
  "One primary Button per view. Everything else is secondary, quiet or a TextButton.",
  "Every form control sits in a Field with a visible label.",
  "Headings use the display face; everything else uses the sans. Numbers and codes use the mono.",
  "Errors say what happened and what to do next. Empty states invite the next action.",
  "Sentence case everywhere. No all-caps labels, no dot-separated meta strings.",
];

export default function StyleguidePage() {
  const [segment, setSegment] = useState<"classic" | "tilt" | "offset">("classic");
  const [tab, setTab] = useState("en-US");
  const [checked, setChecked] = useState(true);
  const [text, setText] = useState("Learn Spanish in 5 minutes a day");

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-5 py-10">
      <header className="flex items-center gap-4">
        <BrandMark size={44} />
        <div>
          <h1 className="font-display text-3xl leading-none">{BRAND.name} components</h1>
          <p className="mt-1.5 text-[13px] text-muted">
            The standard set every screen is built from. Source in <span className="font-mono">src/components/ui</span>.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader title="Rules" description="What keeps the product consistent." />
        <CardBody>
          <MarkedList tone="accent" items={RULES} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Colour" description="Use tokens through Tailwind classes, for example bg-panel or text-muted." />
        <CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {COLORS.map((c) => (
            <div key={c.token}>
              <div className="h-14 rounded-lg ring-1 ring-inset ring-line" style={{ background: `var(--${c.token})` }} />
              <p className="mt-1.5 font-mono text-xs">{c.token}</p>
              <p className="text-xs text-muted">{c.use}</p>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Type" />
        <CardBody className="space-y-3">
          <p className="font-display text-3xl leading-tight">Display, 30. Page and score headlines.</p>
          <p className="font-display text-lg">Display, 18. Card titles.</p>
          <p className="text-sm">Sans, 14. Body text and controls.</p>
          <p className="text-[13px] text-muted">Sans, 13 muted. Descriptions and supporting text.</p>
          <p className="font-mono text-xs">Mono, 12. Counters, codes, file paths: 25/30, en-US, phoneScreenshots/1.png</p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Buttons" description="Verb labels. loading keeps the label and shows a spinner." />
        <CardBody className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Generate listing</Button>
          <Button>Run audit</Button>
          <Button variant="quiet">Cancel</Button>
          <Button variant="danger">Remove</Button>
          <Button variant="primary" loading>
            Generating
          </Button>
          <Button size="sm">Small</Button>
          <Button size="lg" variant="primary">
            Large
          </Button>
          <TextButton>Text button</TextButton>
          <CopyButton text="Copied from the styleguide" />
          <Spinner />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Tags" description="Short status or category text. Removable tags carry a ×." />
        <CardBody className="flex flex-wrap items-center gap-2">
          <Tag>Neutral</Tag>
          <Tag tone="accent">Accent</Tag>
          <Tag tone="ok">Within limit</Tag>
          <Tag tone="warn">Near limit</Tag>
          <Tag tone="bad">Over limit</Tag>
          <Tag tone="accent" onRemove={() => undefined}>
            German
          </Tag>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Forms" />
        <CardBody className="grid gap-5 md:grid-cols-2">
          <Field label="App name" htmlFor="sg-name" aside="Optional" hint="Shown in the listing title.">
            <Input id="sg-name" placeholder="Ritmova" />
          </Field>
          <Field label="Market" htmlFor="sg-market">
            <Select id="sg-market">
              <option>English (US)</option>
              <option>German</option>
            </Select>
          </Field>
          <Field label="Short description" htmlFor="sg-short" aside={<Counter count={text.length} limit={30} />} error={text.length > 30 ? "2 characters over the Google Play limit." : undefined}>
            <Textarea id="sg-short" rows={2} value={text} invalid={text.length > 30} onChange={(e) => setText(e.target.value)} />
          </Field>
          <div className="space-y-4">
            <SegmentedControl label="Layout" options={[{ value: "classic", label: "Classic" }, { value: "tilt", label: "Tilt" }, { value: "offset", label: "Offset" }]} value={segment} onChange={setSegment} />
            <Tabs
              label="Market"
              value={tab}
              onChange={setTab}
              items={[
                { value: "en-US", label: "English (US)" },
                { value: "de-DE", label: "German", flagged: true },
                { value: "ja-JP", label: "Japanese" },
              ]}
            />
            <div className="rounded-lg border border-line p-1">
              <CheckRow checked={checked} onChange={() => setChecked((v) => !v)} aside={<span className="font-mono text-[11px] text-faint">de-DE</span>}>
                German
              </CheckRow>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Feedback" />
        <CardBody className="space-y-3">
          <Notice title="Working from the audit of Ritmova">Missing keywords are added to every market.</Notice>
          <Notice tone="warn" title="Part of this result used simulated output">The image model timed out for Japanese.</Notice>
          <Notice tone="bad" title="The audit could not run" action={<Button size="sm">Try again</Button>}>
            The Play Store did not answer. Check the app ID and try again.
          </Notice>
          <div className="grid gap-3 md:grid-cols-2">
            <Well>
              <EmptyState title="Nothing generated yet" className="py-6">
                Add screenshots and a description, then generate.
              </EmptyState>
            </Well>
            <Well>
              <Working className="py-6">Writing copy for each market.</Working>
            </Well>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Data" />
        <CardBody className="space-y-6">
          <div className="flex flex-wrap items-center gap-8">
            <ScoreDial score={71} />
            <dl className="grid grid-cols-3 gap-6">
              <Stat label="Title" value="25/30" />
              <Stat label="Short" value="82/80" tone="bad" />
              <Stat label="Visual score" value="62" tone="warn" />
            </dl>
            <div className="space-y-2">
              <Meter value={82} />
              <Meter value={68} invert />
            </div>
          </div>
          <Divider />
          <MarkedList tone="bad" items={["Short description wastes 30 characters.", "Screenshots lack a headline."]} />
        </CardBody>
        <Table>
          <thead>
            <tr>
              <th>Keyword</th>
              <th>Relevance</th>
              <th>Where to add it</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-medium">pronunciation</td>
              <td>
                <Meter value={92} />
              </td>
              <td className="text-muted">Short description</td>
            </tr>
            <tr>
              <td className="font-medium">grammar practice</td>
              <td>
                <Meter value={78} />
              </td>
              <td className="text-muted">Full description</td>
            </tr>
          </tbody>
        </Table>
        <div className="h-4" />
      </Card>
    </main>
  );
}
