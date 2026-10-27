/**
 * Meta Model API (https://api.meta.ai/v1) — Muse Spark / Muse Wonder (text + vision),
 * Muse Image (image generation) and SAM 3.1 (segmentation over the Responses API).
 * Docs: https://dev.meta.ai/docs/overview
 */
import {
  extractJson,
  postJson,
  toDataUrl,
  type ChatJsonParams,
  type DetectedBox,
  type GenerateImageParams,
  type ImageProvider,
  type SegmentParams,
  type SegmentProvider,
  type TextProvider,
} from "../types";

function cfg() {
  return {
    apiKey: process.env.META_API_KEY?.trim() || "",
    baseUrl: (process.env.META_API_BASE_URL || "https://api.meta.ai/v1").replace(/\/$/, ""),
    textModel: process.env.META_SPARK_MODEL || "muse-spark-1.3",
    imageModel: process.env.META_IMAGE_MODEL || "muse-image-1.0",
    samModel: process.env.META_SAM_MODEL || "sam-3.1",
  };
}

export function metaConfigured(): boolean {
  return cfg().apiKey.length > 0;
}

function headers() {
  return { Authorization: `Bearer ${cfg().apiKey}` };
}

/* ------------------------------- Text (Muse Spark) ------------------------------- */

export class MetaTextProvider implements TextProvider {
  readonly name = "meta" as const;
  readonly supportsVision = true;
  get model() {
    return cfg().textModel;
  }

  async chatJson<T>({ system, user, images = [], temperature = 0.7 }: ChatJsonParams): Promise<T> {
    const c = cfg();
    const content: unknown[] = [
      { type: "text", text: user },
      ...images.map((url) => ({ type: "image_url", image_url: { url } })),
    ];
    interface ChatResponse {
      choices?: { message?: { content?: string } }[];
    }
    const data = await postJson<ChatResponse>(
      `${c.baseUrl}/chat/completions`,
      {
        model: c.textModel,
        messages: [
          { role: "system", content: system },
          { role: "user", content },
        ],
        response_format: { type: "json_object" },
        temperature,
      },
      headers(),
      "meta",
    );
    return extractJson<T>(data.choices?.[0]?.message?.content ?? "");
  }
}

/* ------------------------------ Image (Muse Image) ------------------------------ */

const SIZE_BY_ASPECT: Record<GenerateImageParams["aspect"], string> = {
  "9:16": "1024x1792",
  "16:9": "1792x1024",
  "1:1": "1024x1024",
};

export class MetaImageProvider implements ImageProvider {
  readonly name = "meta" as const;
  get model() {
    return cfg().imageModel;
  }

  async generateImage({ prompt, aspect }: GenerateImageParams): Promise<string> {
    const c = cfg();
    interface ImageResponse {
      data?: { url?: string; b64_json?: string }[];
      output_format?: string;
    }
    // Grounding tools are switched off and reasoning lowered: a background needs speed, not research.
    const data = await postJson<ImageResponse>(
      `${c.baseUrl}/images/generations`,
      {
        model: c.imageModel,
        prompt,
        n: 1,
        size: SIZE_BY_ASPECT[aspect],
        output_format: "png",
        response_format: "b64_json",
        reasoning_strength: "low",
        tool_enablement: { enable_image_search: false, enable_web_search: false, enable_shell: false },
      },
      headers(),
      "meta",
    );
    const first = data.data?.[0];
    const mime = `image/${data.output_format || "png"}`;
    if (first?.b64_json) return `data:${mime};base64,${first.b64_json}`;
    if (first?.url) return toDataUrl(first.url);
    throw new Error("Muse Image returned no image");
  }
}

/* ------------------------------ Segmentation (SAM 3.1) ------------------------------ */

interface ParsedBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w: number;
  h: number;
  c?: number;
}

/**
 * Parses SAM 3.1 special-token output_text, e.g.
 *   <0f>0<|box;x1=353;y1=382;x2=453;y2=427;w=537;h=561;c=0.96|><|mask;...|>,1<|box;...|>
 * Only boxes are needed for floating badges; masks are ignored.
 */
export function parseSamBoxes(text: string): ParsedBox[] {
  const re = /<\|box;x1=(\d+);y1=(\d+);x2=(\d+);y2=(\d+);w=(\d+);h=(\d+)(?:;c=([\d.]+))?\|>/g;
  const out: ParsedBox[] = [];
  for (const m of text.matchAll(re)) {
    out.push({ x1: +m[1], y1: +m[2], x2: +m[3], y2: +m[4], w: +m[5], h: +m[6], c: m[7] !== undefined ? +m[7] : undefined });
  }
  return out;
}

function responsesOutputText(data: unknown): string {
  const d = data as {
    output_text?: string;
    output?: { type?: string; content?: { type?: string; text?: string }[] }[];
  };
  if (typeof d.output_text === "string") return d.output_text;
  return (d.output ?? [])
    .filter((o) => o.type === "message")
    .flatMap((o) => o.content ?? [])
    .filter((c) => c.type === "output_text" && typeof c.text === "string")
    .map((c) => c.text as string)
    .join("\n");
}

export class MetaSegmentProvider implements SegmentProvider {
  readonly name = "meta" as const;
  get model() {
    return cfg().samModel;
  }

  /** SAM matches one concept per request, so prompts run in parallel and are merged. */
  async segment({ imageDataUrl, prompts }: SegmentParams): Promise<DetectedBox[]> {
    const c = cfg();
    const perPrompt = await Promise.all(
      prompts.map(async (prompt) => {
        const data = await postJson<unknown>(
          `${c.baseUrl}/responses`,
          {
            model: c.samModel,
            input: [
              {
                type: "message",
                role: "user",
                content: [
                  { type: "input_text", text: prompt },
                  { type: "input_image", image_url: imageDataUrl },
                ],
              },
            ],
            stream: false,
            metadata: { include_confidence: "true", mask_encoding: "one_bit" },
          },
          headers(),
          "meta",
        );
        return parseSamBoxes(responsesOutputText(data)).map((b) => ({ prompt, b }));
      }),
    );
    return perPrompt.flat().flatMap(({ prompt, b }) => {
      if (b.w <= 0 || b.h <= 0) return [];
      return [
        {
          label: prompt,
          score: b.c ?? 0.85,
          bbox: { x: b.x1 / b.w, y: b.y1 / b.h, w: (b.x2 - b.x1) / b.w, h: (b.y2 - b.y1) / b.h },
        },
      ];
    });
  }
}
