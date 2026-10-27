# LocaLaunch AI — Multimodal ASO Localization Agent

Turn 1–3 raw mobile screenshots into localized Google Play posters and listing metadata for several markets at once, powered by Meta models:

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
| `META_API_KEY` | Meta Model API key. **Empty = simulation mode** (realistic mock copy, SVG backgrounds, preset segments). |
| `MOCK_MODE` | `true` forces simulation even when a key is present. |
| `META_API_BASE_URL` | API base (default `https://api.llama.com/v1`). |
| `META_SAM_MODEL`, `META_SPARK_MODEL`, `META_IMAGE_MODEL` | Model IDs exposed by your tenant. |

In live mode every model call that fails falls back to its simulated counterpart and the UI lists the fallback in a warning banner, so a demo never breaks.

## Project layout

```
src/
  app/
    page.tsx                     # 3-panel workspace (Input · Poster Studio · Metadata Inspector)
    api/generate-aso/route.ts    # POST: orchestrates the pipeline; GET: reports mock/live mode
    api/segment/route.ts         # POST: SAM 3.1 candidate regions for the Segment Picker
  lib/
    meta-ai.ts                   # Service layer: SAM 3.1, Muse Spark, Muse Image + mocks + orchestrator
    types.ts                     # Shared request/response types, Google Play limits
    locales.ts                   # Supported markets (en-US, ja-JP, id-ID, ar-SA RTL, es-ES)
    export.ts                    # PNG render + Fastlane ZIP builder
    image.ts                     # Client-side screenshot resize helpers
  components/
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
