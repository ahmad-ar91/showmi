/**
 * Resolves which vendor backs each capability from env vars, with automatic fallback to
 * the simulated provider when a vendor is not configured (or MOCK_MODE=true).
 *
 *   AI_PROVIDER=meta            # default for every capability
 *   AI_TEXT_PROVIDER=deepseek   # override per capability
 *   AI_IMAGE_PROVIDER=google
 *   AI_SEGMENT_PROVIDER=meta
 */
import "server-only";
import { deepseekConfigured, DeepSeekTextProvider } from "./providers/deepseek";
import { googleConfigured, GoogleImageProvider, GoogleSegmentProvider, GoogleTextProvider } from "./providers/google";
import { metaConfigured, MetaImageProvider, MetaSegmentProvider, MetaTextProvider } from "./providers/meta";
import { MockImageProvider, MockSegmentProvider, MockTextProvider } from "./providers/mock";
import type { ImageProvider, ProviderName, SegmentProvider, TextProvider } from "./types";

type Capability = "text" | "image" | "segment";

const CONFIGURED: Record<Exclude<ProviderName, "mock">, () => boolean> = {
  meta: metaConfigured,
  google: googleConfigured,
  deepseek: deepseekConfigured,
};

/** Which vendors can serve each capability at all. */
const SUPPORTS: Record<Capability, ProviderName[]> = {
  text: ["meta", "google", "deepseek", "mock"],
  image: ["meta", "google", "mock"],
  segment: ["meta", "google", "mock"],
};

function parseName(value: string | undefined): ProviderName | undefined {
  const v = value?.trim().toLowerCase();
  return v === "meta" || v === "google" || v === "deepseek" || v === "mock" ? v : undefined;
}

export interface ResolvedProvider {
  name: ProviderName;
  /** Why the resolver landed on this provider (shown in the UI status badge). */
  reason: "configured" | "mock-mode" | "not-configured" | "unsupported";
  requested: ProviderName;
}

export function resolveProvider(capability: Capability): ResolvedProvider {
  const requested =
    parseName(process.env[`AI_${capability.toUpperCase()}_PROVIDER`]) ?? parseName(process.env.AI_PROVIDER) ?? "meta";
  if (process.env.MOCK_MODE === "true") return { name: "mock", reason: "mock-mode", requested };
  if (requested === "mock") return { name: "mock", reason: "configured", requested };
  if (!SUPPORTS[capability].includes(requested)) return { name: "mock", reason: "unsupported", requested };
  if (!CONFIGURED[requested]()) return { name: "mock", reason: "not-configured", requested };
  return { name: requested, reason: "configured", requested };
}

export function getTextProvider(): TextProvider {
  switch (resolveProvider("text").name) {
    case "meta":
      return new MetaTextProvider();
    case "google":
      return new GoogleTextProvider();
    case "deepseek":
      return new DeepSeekTextProvider();
    default:
      return new MockTextProvider();
  }
}

export function getImageProvider(): ImageProvider {
  switch (resolveProvider("image").name) {
    case "meta":
      return new MetaImageProvider();
    case "google":
      return new GoogleImageProvider();
    default:
      return new MockImageProvider();
  }
}

export function getSegmentProvider(): SegmentProvider {
  switch (resolveProvider("segment").name) {
    case "meta":
      return new MetaSegmentProvider();
    case "google":
      return new GoogleSegmentProvider();
    default:
      return new MockSegmentProvider();
  }
}

/** Summary for the UI status badge and /api/generate-aso GET. */
export function providerStatus() {
  const text = resolveProvider("text");
  const image = resolveProvider("image");
  const segment = resolveProvider("segment");
  const live = [text, image, segment].some((p) => p.name !== "mock");
  return {
    mode: live ? ("live" as const) : ("mock" as const),
    text: { ...text, model: getTextProvider().model },
    image: { ...image, model: getImageProvider().model },
    segment: { ...segment, model: getSegmentProvider().model },
  };
}
