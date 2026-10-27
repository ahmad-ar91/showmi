/**
 * Google Gemini (Generative Language API) — text + vision JSON via gemini-2.5-flash,
 * image generation via gemini-2.5-flash-image, and UI element detection via Gemini's
 * native bounding-box output (box_2d in 0..1000 coordinates).
 * Docs: https://ai.google.dev/gemini-api/docs
 */
import {
  extractJson,
  postJson,
  splitDataUrl,
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
    apiKey: process.env.GOOGLE_API_KEY?.trim() || "",
    baseUrl: (process.env.GOOGLE_API_BASE_URL || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, ""),
    textModel: process.env.GOOGLE_TEXT_MODEL || "gemini-2.5-flash",
    imageModel: process.env.GOOGLE_IMAGE_MODEL || "gemini-2.5-flash-image",
    visionModel: process.env.GOOGLE_VISION_MODEL || process.env.GOOGLE_TEXT_MODEL || "gemini-2.5-flash",
  };
}

export function googleConfigured(): boolean {
  return cfg().apiKey.length > 0;
}

function headers() {
  return { "x-goog-api-key": cfg().apiKey };
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string; inlineData?: { mimeType: string; data: string } }[] };
  }[];
}

function imagePart(dataUrl: string) {
  const { mime, base64 } = splitDataUrl(dataUrl);
  return { inlineData: { mimeType: mime, data: base64 } };
}

function textOf(data: GeminiResponse): string {
  return (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("");
}

export class GoogleTextProvider implements TextProvider {
  readonly name = "google" as const;
  readonly supportsVision = true;
  get model() {
    return cfg().textModel;
  }

  async chatJson<T>({ system, user, images = [], temperature = 0.7 }: ChatJsonParams): Promise<T> {
    const c = cfg();
    const data = await postJson<GeminiResponse>(
      `${c.baseUrl}/models/${c.textModel}:generateContent`,
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }, ...images.map(imagePart)] }],
        generationConfig: { temperature, responseMimeType: "application/json" },
      },
      headers(),
      "google",
    );
    return extractJson<T>(textOf(data));
  }
}

export class GoogleImageProvider implements ImageProvider {
  readonly name = "google" as const;
  get model() {
    return cfg().imageModel;
  }

  async generateImage({ prompt, aspect }: GenerateImageParams): Promise<string> {
    const c = cfg();
    const data = await postJson<GeminiResponse>(
      `${c.baseUrl}/models/${c.imageModel}:generateContent`,
      {
        contents: [{ role: "user", parts: [{ text: `${prompt} Aspect ratio ${aspect}.` }] }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: aspect } },
      },
      headers(),
      "google",
    );
    const img = (data.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData)?.inlineData;
    if (!img) throw new Error("Gemini returned no image");
    return `data:${img.mimeType};base64,${img.data}`;
  }
}

export class GoogleSegmentProvider implements SegmentProvider {
  readonly name = "google" as const;
  get model() {
    return cfg().visionModel;
  }

  async segment({ imageDataUrl, prompts }: SegmentParams): Promise<DetectedBox[]> {
    const c = cfg();
    interface Out {
      items: { label: string; confidence?: number; box_2d: [number, number, number, number] }[];
    }
    const data = await postJson<GeminiResponse>(
      `${c.baseUrl}/models/${c.visionModel}:generateContent`,
      {
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Detect the prominent UI elements in this mobile app screenshot matching: ${prompts.join(", ")}. Return JSON {"items":[{"label":string,"confidence":number,"box_2d":[ymin,xmin,ymax,xmax]}]} with box_2d normalised to 0-1000. At most 8 items.`,
              },
              imagePart(imageDataUrl),
            ],
          },
        ],
        generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
      },
      headers(),
      "google",
    );
    const out = extractJson<Out>(textOf(data));
    return (out.items ?? []).map((it) => {
      const [ymin, xmin, ymax, xmax] = it.box_2d;
      return {
        label: it.label,
        score: it.confidence ?? 0.8,
        bbox: { x: xmin / 1000, y: ymin / 1000, w: (xmax - xmin) / 1000, h: (ymax - ymin) / 1000 },
      };
    });
  }
}
