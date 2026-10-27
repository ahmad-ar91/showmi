import { NextResponse } from "next/server";
import { generateAsoPackage, providerStatus } from "@/lib/meta-ai";
import { isLocaleCode } from "@/lib/locales";
import type { GenerateAsoRequest, LocaleCode, Segment } from "@/lib/types";

export const maxDuration = 120;

const MAX_SCREENSHOTS = 3;
const MAX_DESCRIPTION = 1500;

function validate(body: unknown): { ok: true; req: GenerateAsoRequest } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Body must be a JSON object." };
  const b = body as Record<string, unknown>;

  const description = typeof b.description === "string" ? b.description.trim() : "";
  if (!description) return { ok: false, error: "description is required." };
  if (description.length > MAX_DESCRIPTION)
    return { ok: false, error: `description must be <= ${MAX_DESCRIPTION} chars.` };

  const screenshots = Array.isArray(b.screenshots) ? b.screenshots : [];
  if (screenshots.length < 1 || screenshots.length > MAX_SCREENSHOTS)
    return { ok: false, error: `Provide 1-${MAX_SCREENSHOTS} screenshots.` };
  if (!screenshots.every((s) => typeof s === "string" && /^data:image\/(png|jpe?g|webp);base64,/.test(s)))
    return { ok: false, error: "Each screenshot must be a PNG/JPG/WEBP data URL." };

  const locales = Array.isArray(b.locales) ? b.locales : [];
  if (locales.length < 1) return { ok: false, error: "Select at least one locale." };
  if (!locales.every(isLocaleCode)) return { ok: false, error: "Unknown locale code." };

  let segments: Segment[][] | undefined;
  if (b.segments !== undefined) {
    if (!Array.isArray(b.segments) || b.segments.length !== screenshots.length)
      return { ok: false, error: "segments must be an array with one entry per screenshot." };
    const isSeg = (s: unknown): s is Segment => {
      if (!s || typeof s !== "object") return false;
      const o = s as Record<string, unknown>;
      const bb = o.bbox as Record<string, unknown> | undefined;
      return (
        typeof o.id === "string" &&
        typeof o.label === "string" &&
        !!bb &&
        ["x", "y", "w", "h"].every((k) => typeof bb[k] === "number" && (bb[k] as number) >= 0 && (bb[k] as number) <= 1)
      );
    };
    if (!b.segments.every((list) => Array.isArray(list) && list.length <= 4 && list.every(isSeg)))
      return { ok: false, error: "Invalid segment entry." };
    segments = b.segments as Segment[][];
  }

  return {
    ok: true,
    req: {
      appName: typeof b.appName === "string" ? b.appName : undefined,
      description,
      screenshots: screenshots as string[],
      locales: Array.from(new Set(locales as LocaleCode[])),
      segments,
      keywords: Array.isArray(b.keywords) ? (b.keywords as unknown[]).filter((k): k is string => typeof k === "string").slice(0, 20) : undefined,
      weaknesses: Array.isArray(b.weaknesses) ? (b.weaknesses as unknown[]).filter((k): k is string => typeof k === "string").slice(0, 10) : undefined,
    },
  };
}

export async function GET() {
  return NextResponse.json({ ok: true, ...providerStatus() });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const v = validate(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  try {
    const result = await generateAsoPackage(v.req);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[generate-aso]", err);
    return NextResponse.json({ error: (err as Error).message || "Generation failed." }, { status: 500 });
  }
}
