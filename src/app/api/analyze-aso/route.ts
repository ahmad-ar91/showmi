import { NextResponse } from "next/server";
import { auditListing } from "@/lib/aso-analytics";
import { fetchListing, parseAppId } from "@/lib/play-store";
import { SAMPLE_APP_ID, SAMPLE_COMPETITOR_ID, isSampleApp, sampleListing } from "@/lib/demo/sample-apps";

// One audit per request; fits the 60 s limit of the free serverless tier.
export const maxDuration = 60;

/**
 * POST { appId, competitorAppId?, demo?: boolean, previousWeaknesses?: string[] }
 * The competitor is optional: without one, keyword findings become category opportunities.
 * Pulls the listings from Google Play, or uses the fictional sample apps when demo is true,
 * then runs the visual (segmentation) and semantic (text model) audit.
 */
export async function POST(request: Request) {
  let body: { appId?: unknown; competitorAppId?: unknown; demo?: unknown; previousWeaknesses?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const demo = body.demo === true;
  const appId = demo ? SAMPLE_APP_ID : parseAppId(typeof body.appId === "string" ? body.appId : "");
  const competitorInput = typeof body.competitorAppId === "string" ? body.competitorAppId.trim() : "";
  const competitorAppId = demo ? SAMPLE_COMPETITOR_ID : competitorInput ? parseAppId(competitorInput) : null;

  if (!appId) return NextResponse.json({ error: "Enter a valid Google Play app ID or URL for your app." }, { status: 400 });
  if (competitorInput && !competitorAppId)
    return NextResponse.json(
      { error: "The competitor is not a valid Google Play app ID or URL. Fix it or leave the field empty." },
      { status: 400 },
    );
  if (competitorAppId && appId === competitorAppId)
    return NextResponse.json({ error: "Competitor must be a different app." }, { status: 400 });

  try {
    const load = (id: string) => (isSampleApp(id) ? sampleListing(id) : fetchListing(id));
    const [app, competitor] = await Promise.all([load(appId), competitorAppId ? load(competitorAppId) : Promise.resolve(null)]);
    // Weaknesses from the audit the owner acted on, so the model can say which ones are fixed.
    const previousWeaknesses = Array.isArray(body.previousWeaknesses)
      ? body.previousWeaknesses.filter((w): w is string => typeof w === "string").map((w) => w.slice(0, 400))
      : [];
    const analysis = await auditListing(app, competitor, { screenshots: 2, previousWeaknesses });
    return NextResponse.json(analysis);
  } catch (err) {
    console.error("[analyze-aso]", err);
    return NextResponse.json({ error: (err as Error).message || "Analysis failed." }, { status: 500 });
  }
}
