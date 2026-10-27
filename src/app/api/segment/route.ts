import { NextResponse } from "next/server";
import { segmentWithFallback } from "@/lib/meta-ai";
import type { SegmentResponse } from "@/lib/types";

export const maxDuration = 60;

/** POST { screenshot: dataUrl, index } -> SAM 3.1 candidate UI regions for the Segment Picker. */
export async function POST(request: Request) {
  let body: { screenshot?: unknown; index?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const screenshot = typeof body.screenshot === "string" ? body.screenshot : "";
  if (!/^data:image\/(png|jpe?g|webp);base64,/.test(screenshot))
    return NextResponse.json({ error: "screenshot must be a PNG/JPG/WEBP data URL." }, { status: 400 });
  const index = Number.isInteger(body.index) && (body.index as number) >= 0 ? (body.index as number) : 0;

  try {
    const result: SegmentResponse = await segmentWithFallback(screenshot, index);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[segment]", err);
    return NextResponse.json({ error: (err as Error).message || "Segmentation failed." }, { status: 500 });
  }
}
