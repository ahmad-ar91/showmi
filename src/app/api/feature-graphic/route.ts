import { NextResponse } from "next/server";
import { generateFeatureArtFor } from "@/lib/meta-ai";
import { isLocaleCode } from "@/lib/locales";

// The browser sends one market per request, so each call fits the 60 s free-tier limit.
export const maxDuration = 60;

/** POST { locales: string[], description: string } -> { art: { [locale]: dataUrl }, warnings, mode } */
export async function POST(request: Request) {
  let body: { locales?: unknown; description?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const locales = Array.isArray(body.locales) ? Array.from(new Set(body.locales.filter(isLocaleCode))) : [];
  if (!locales.length) return NextResponse.json({ error: "Choose at least one market." }, { status: 400 });
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 1500) : "";
  if (!description) return NextResponse.json({ error: "Describe the app first." }, { status: 400 });

  try {
    return NextResponse.json(await generateFeatureArtFor(locales, description));
  } catch (err) {
    console.error("[feature-graphic]", err);
    return NextResponse.json({ error: (err as Error).message || "Feature art failed." }, { status: 500 });
  }
}
