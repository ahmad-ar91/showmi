import { NextResponse } from "next/server";
import { auditListing } from "@/lib/aso-analytics";
import { DEMO_APP_ID, DEMO_COMPETITOR_ID, fetchListing, parseAppId } from "@/lib/play-store";

export const maxDuration = 120;

/**
 * POST { appId, competitorAppId?, demo?: boolean }
 * The competitor is optional: without one, keyword findings become category opportunities.
 * Pulls both listings from Google Play (or the bundled demo snapshot), then runs the
 * visual (segmentation) and semantic (text model) audit.
 */
export async function POST(request: Request) {
  let body: { appId?: unknown; competitorAppId?: unknown; demo?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const demo = body.demo === true;
  const appId = demo ? DEMO_APP_ID : parseAppId(typeof body.appId === "string" ? body.appId : "");
  const competitorInput = typeof body.competitorAppId === "string" ? body.competitorAppId.trim() : "";
  const competitorAppId = demo ? DEMO_COMPETITOR_ID : competitorInput ? parseAppId(competitorInput) : null;

  if (!appId) return NextResponse.json({ error: "Enter a valid Google Play app ID or URL for your app." }, { status: 400 });
  if (competitorInput && !competitorAppId)
    return NextResponse.json(
      { error: "The competitor is not a valid Google Play app ID or URL. Fix it or leave the field empty." },
      { status: 400 },
    );
  if (competitorAppId && appId === competitorAppId)
    return NextResponse.json({ error: "Competitor must be a different app." }, { status: 400 });

  try {
    const [app, competitor] = await Promise.all([
      fetchListing(appId),
      competitorAppId ? fetchListing(competitorAppId) : Promise.resolve(null),
    ]);
    const analysis = await auditListing(app, competitor, { screenshots: 2 });
    return NextResponse.json(analysis);
  } catch (err) {
    console.error("[analyze-aso]", err);
    return NextResponse.json({ error: (err as Error).message || "Analysis failed." }, { status: 500 });
  }
}
