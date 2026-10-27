# LocaLaunch AI — End-to-End ASO Analytics & Localization Agent

Audit a Google Play listing against a competitor, fix its weaknesses with localized copy and posters, and ship a Fastlane bundle — in three connected tabs:

| Tab | What it does |
| --- | --- |
| **1 · ASO Intelligence & Audit** | Pulls live listings with `google-play-scraper`, scores 5 metrics on a `recharts` radar (ASO Health 0–100), tears down screenshots with SAM 3.1 (detections, clutter score, focal-point heatmap, Muse critique) and lists the competitor keyword gap. **Fix & Localize Weaknesses** hands everything to Tab 2. |
| **2 · Localization Studio** | Interactive SAM segment picker → floating 3D badges on 9:16 posters, Muse Spark copy with missing keywords injected, Muse Image cultural backgrounds, Play Console limits enforced. |
| **3 · Store Simulator & Export** | Google Play search mock-up: your listing before vs after, next to the competitor, plus one-click Fastlane ZIP. |

Press **Load Demo Data (Real App vs Competitor)** on Tab 1 for a one-click judge demo (Ritmova vs Paceto, with a bundled snapshot fallback if scraping is blocked).

Powered by Meta models by default:

| Step | Model | Output |
| --- | --- | --- |
| 1 | **SAM 3.1** | Segments key UI elements from each screenshot (rendered as floating cards on the poster) |
| 2 | **Muse Spark** | Per-locale Title (≤30), Short Description (≤80), Full Description (≤4000), keywords, poster headlines |
| 3 | **Muse Image** | Culturally-aware 9:16 poster background per locale |

Everything runs in a single Next.js app. Posters are rendered client-side (`html-to-image`) at 1080×1920 and bundled with the text into a Fastlane `supply`-compatible ZIP (`jszip`).

## Quick start

```bash
npm install
cp .env.example .env.local   # leave META_API_KEY empty to use simulation mode
npm run dev
```

Open http://localhost:3000.

### Environment

| Variable | Purpose |
| --- | --- |
| `META_API_KEY` | Meta Model API key (https://dev.meta.ai). **Empty = simulation mode** (realistic mock copy, SVG backgrounds, preset segments). |
| `MOCK_MODE` | `true` forces simulation even when keys are present. |
| `META_API_BASE_URL` | API base (default `https://api.meta.ai/v1`). |
| `META_SAM_MODEL`, `META_SPARK_MODEL`, `META_IMAGE_MODEL` | Model IDs (`sam-3.1`, `muse-spark-1.3`, `muse-image-1.0`). |

In live mode every model call that fails falls back to its simulated counterpart and the UI lists the fallback in a warning banner, so a demo never breaks.

### Swapping AI vendors (Meta · Google · DeepSeek)

The orchestrator only talks to three interfaces in `src/lib/ai/types.ts` — `TextProvider`, `ImageProvider`, `SegmentProvider` — so each capability can be backed by a different vendor:

```
AI_PROVIDER=meta            # default for all capabilities: meta | google | deepseek | mock
AI_TEXT_PROVIDER=deepseek   # per-capability overrides
AI_IMAGE_PROVIDER=google
AI_SEGMENT_PROVIDER=google
```

| Provider | Text / JSON | Image generation | UI detection | Keys |
| --- | --- | --- | --- | --- |
| `meta` | Muse Spark / Wonder | Muse Image | SAM 3.1 (Responses API) | `META_API_KEY` |
| `google` | Gemini 2.5 Flash | Gemini 2.5 Flash Image | Gemini bounding boxes | `GOOGLE_API_KEY` |
| `deepseek` | deepseek-chat (text only) | — | — | `DEEPSEEK_API_KEY` |
| `mock` | deterministic copy bank | SVG motifs | preset regions | none |

A vendor without a key (or one that cannot serve a capability) silently resolves to `mock`. To add another vendor, implement the interfaces in `src/lib/ai/providers/<name>.ts` and register it in `src/lib/ai/registry.ts`.

## Project layout

```
src/
  app/
    page.tsx                     # 3-panel workspace (Input · Poster Studio · Metadata Inspector)
    api/generate-aso/route.ts    # POST: localization pipeline; GET: provider status
    api/segment/route.ts         # POST: candidate UI regions for the Segment Picker
    api/analyze-aso/route.ts     # POST: scrape Play listings + SAM/Muse audit
  lib/
    meta-ai.ts                   # Orchestrator (segmentation, copy, backgrounds) over the provider interfaces
    aso-analytics.ts             # ASO audit: metrics, visual teardown, keyword gap, compliance
    play-store.ts                # google-play-scraper wrapper + bundled demo snapshots
    ai/types.ts                  # TextProvider / ImageProvider / SegmentProvider interfaces
    ai/registry.ts               # Env-driven vendor selection with mock fallback
    ai/providers/{meta,google,deepseek,mock}.ts
    types.ts                     # Shared request/response types, Google Play limits
    locales.ts                   # Supported markets (en-US, ja-JP, id-ID, ar-SA RTL, es-ES)
    export.ts                    # PNG render + Fastlane ZIP builder
    image.ts                     # Client-side screenshot resize helpers
  components/
    AsoAnalytics.tsx             # Tab 1 dashboard
    LocalizationStudio.tsx       # Tab 2 (wraps the 3-panel workspace)
    StoreSimulator.tsx           # Tab 3 Play Store mock-up + export
    workspace/InputPanel.tsx     # Upload 1–3 screenshots, app brief, target markets
    workspace/SegmentPicker.tsx  # Interactive SAM 3.1 overlay: click regions to float them as 3D badges
    workspace/PosterStudio.tsx   # Layout presets (Classic / Tilt / Offset), text position, export
    workspace/PosterCanvas.tsx   # 9:16 poster: background, localized copy, phone mockup, floating UI cards
    workspace/MetadataInspector.tsx  # Editable Title/Short/Full with live counters + Copy
    ui/                          # Minimal shadcn-style primitives (Button, Badge, Panel)
```

## API

`POST /api/generate-aso`

```json
{
  "appName": "Ritmova",
  "description": "A habit and workout tracker …",
  "screenshots": ["data:image/png;base64,…"],
  "locales": ["en-US", "ja-JP", "id-ID", "ar-SA", "es-ES"]
}
```

Returns `{ mode, segments[][], locales[], warnings[], generatedAt }` where each locale entry carries `metadata`, `posters[]` (headline/sub-headline per screenshot), `backgroundDataUrl` and `culturalNote`.

## Demo highlights

- **Interactive SAM 3.1 Segment Picker** — every upload is segmented immediately; detected UI regions are drawn as clickable bounding boxes. Pick up to 3 per screenshot and they peel off the phone as floating 3D badges on every locale's poster (live-updating, no regenerate needed).
- **1-Click Fastlane ZIP Exporter** — one button renders every poster at 1080×1920 and writes the standard Fastlane `supply` tree, ready for `fastlane supply` straight into Google Play Console.

## Export format

```
fastlane/metadata/android/<locale>/
  title.txt
  short_description.txt
  full_description.txt
  keywords.txt
  images/phoneScreenshots/1.png, 2.png …     (1080×1920)
localaunch-manifest.json
README.md
```

Upload with `fastlane supply --metadata_path ./fastlane/metadata/android --skip_upload_apk`.
