/**
 * Provider-agnostic AI interfaces. Every model vendor (Meta, Google, DeepSeek, …) implements
 * one or more of these, and the orchestrator in `src/lib/meta-ai.ts` only talks to the interfaces.
 *
 * Select providers with env vars (see `.env.example`):
 *   AI_PROVIDER            default for all three capabilities (meta | google | deepseek | mock)
 *   AI_TEXT_PROVIDER       text / JSON reasoning (ASO copy, analytics)
 *   AI_IMAGE_PROVIDER      poster backgrounds
 *   AI_SEGMENT_PROVIDER    UI element detection
 */

export type ProviderName = "meta" | "google" | "deepseek" | "mock";

export interface ChatJsonParams {
  /** System instructions; must describe the exact JSON shape expected. */
  system: string;
  /** User turn text. */
  user: string;
  /** Optional image data URLs for vision-capable models. */
  images?: string[];
  temperature?: number;
}

export interface TextProvider {
  readonly name: ProviderName;
  readonly model: string;
  /** Whether the provider can read images. If false, callers may still pass images; they are dropped. */
  readonly supportsVision: boolean;
  chatJson<T>(params: ChatJsonParams): Promise<T>;
}

export interface GenerateImageParams {
  prompt: string;
  /** Aspect ratio hint, e.g. "9:16". */
  aspect: "9:16" | "16:9" | "1:1";
  /** Free-form hint (e.g. locale code) that simulated providers use to pick deterministic output. */
  hint?: string;
}

export interface ImageProvider {
  readonly name: ProviderName;
  readonly model: string;
  /** Returns a data URL (image/png, image/webp or image/jpeg). */
  generateImage(params: GenerateImageParams): Promise<string>;
}

/** A detected region, normalised to 0..1 of the source image. */
export interface DetectedBox {
  label: string;
  score: number;
  bbox: { x: number; y: number; w: number; h: number };
}

export interface SegmentParams {
  imageDataUrl: string;
  /** Short noun phrases describing what to find (UI cards, buttons…). */
  prompts: string[];
  /** Free-form hint (e.g. screenshot index) that simulated providers use to pick deterministic output. */
  hint?: number;
}

export interface SegmentProvider {
  readonly name: ProviderName;
  readonly model: string;
  segment(params: SegmentParams): Promise<DetectedBox[]>;
}

export class ProviderError extends Error {
  constructor(
    public readonly provider: ProviderName,
    message: string,
  ) {
    super(`[${provider}] ${message}`);
    this.name = "ProviderError";
  }
}

export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("Model returned no JSON object.");
  return JSON.parse(raw.slice(start, end + 1)) as T;
}

export async function postJson<T>(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  provider: ProviderName,
): Promise<T> {
  // Fail before the hosting platform kills the function, so the caller can fall back cleanly.
  const timeoutMs = Number(process.env.AI_TIMEOUT_MS) || 45_000;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const name = (err as Error).name;
    if (name === "TimeoutError" || name === "AbortError")
      throw new ProviderError(provider, `${new URL(url).pathname} timed out after ${Math.round(timeoutMs / 1000)} s`);
    throw new ProviderError(provider, `${new URL(url).pathname} could not be reached: ${(err as Error).message}`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ProviderError(provider, `${new URL(url).pathname} → ${res.status} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** Download a remote image and convert it to a data URL so the client canvas can embed it. */
export async function toDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch image ${res.status}`);
  const mime = res.headers.get("content-type")?.split(";")[0] || "image/png";
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:${mime};base64,${buf.toString("base64")}`;
}

export function splitDataUrl(dataUrl: string): { mime: string; base64: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,([\s\S]*)$/);
  if (!m) throw new Error("Expected a base64 data URL");
  return { mime: m[1], base64: m[2] };
}
