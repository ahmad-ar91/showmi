import { NextResponse } from "next/server";
import {
  PLAY_IMAGE_TYPES,
  PlayError,
  allowedPackages,
  clearImages,
  commitEdit,
  deleteEdit,
  openEdit,
  playStatus,
  updateListing,
  uploadImage,
  validateEdit,
  type PlayImageType,
} from "@/lib/google-play";
import { LOCALES } from "@/lib/locales";
import { PLAY_LIMITS } from "@/lib/types";
import { charCount } from "@/lib/utils";

// Each step is its own small request, so an edit with many markets never hits body or time limits.
export const maxDuration = 60;

const LANGUAGES = new Set(LOCALES.map((l) => l.playStoreCode));
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // Google Play's limit per image

type Action = "open" | "listing" | "clear" | "validate" | "commit" | "discard" | "upload";

/** GET: whether publishing is set up here, the service account and the packages it may edit. */
export async function GET() {
  return NextResponse.json(playStatus());
}

/**
 * POST JSON { action, packageName, editId?, language?, imageType?, listing? }, or
 * POST an image body (image/png or image/jpeg) with ?action=upload&packageName&editId&language&imageType.
 * Only packages listed in GOOGLE_PLAY_PACKAGES are accepted.
 */
export async function POST(request: Request) {
  try {
    const status = playStatus();
    if (!status.configured) {
      throw new PlayError(status.error ?? "Google Play publishing is not set up on this server. See Publish to Google Play in the README.", 503);
    }

    const type = request.headers.get("content-type") ?? "";
    const isImage = type.startsWith("image/");
    const query = new URL(request.url).searchParams;
    const body: Record<string, unknown> = isImage ? Object.fromEntries(query) : await request.json().catch(() => ({}));

    const action = String(body.action ?? "") as Action;
    const pkg = String(body.packageName ?? "");
    if (!allowedPackages().includes(pkg)) {
      throw new PlayError(`${pkg || "This app"} is not in GOOGLE_PLAY_PACKAGES, so ShowMi will not touch it.`, 403);
    }
    const editId = String(body.editId ?? "");
    const language = String(body.language ?? "");
    const needEdit = () => {
      if (!/^[\w-]{4,80}$/.test(editId)) throw new PlayError("Missing or invalid edit id.", 400);
    };
    const needLanguage = () => {
      if (!LANGUAGES.has(language)) throw new PlayError(`Unknown Google Play language "${language}".`, 400);
    };
    const imageType = (): PlayImageType => {
      const t = String(body.imageType ?? "") as PlayImageType;
      if (!PLAY_IMAGE_TYPES.includes(t)) throw new PlayError("imageType must be phoneScreenshots or featureGraphic.", 400);
      return t;
    };

    switch (action) {
      case "open":
        return NextResponse.json({ editId: await openEdit(pkg) });

      case "listing": {
        needEdit();
        needLanguage();
        const l = (body.listing ?? {}) as Record<string, unknown>;
        const listing = {
          title: String(l.title ?? ""),
          shortDescription: String(l.shortDescription ?? ""),
          fullDescription: String(l.fullDescription ?? ""),
        };
        const over = (Object.keys(listing) as (keyof typeof listing)[]).find(
          (k) => !listing[k].trim() || charCount(listing[k]) > PLAY_LIMITS[k],
        );
        if (over) throw new PlayError(`${language}: ${over} is empty or over the Play limit of ${PLAY_LIMITS[over]} characters.`, 400);
        await updateListing(pkg, editId, language, listing);
        return NextResponse.json({ ok: true });
      }

      case "clear":
        needEdit();
        needLanguage();
        await clearImages(pkg, editId, language, imageType());
        return NextResponse.json({ ok: true });

      case "upload": {
        needEdit();
        needLanguage();
        if (!isImage || !/^image\/(png|jpeg)$/.test(type)) throw new PlayError("Upload a PNG or JPEG image.", 400);
        const bytes = await request.arrayBuffer();
        if (!bytes.byteLength || bytes.byteLength > MAX_IMAGE_BYTES) throw new PlayError("Images must be between 1 byte and 8 MB.", 400);
        await uploadImage(pkg, editId, language, imageType(), bytes, type);
        return NextResponse.json({ ok: true });
      }

      case "validate":
        needEdit();
        await validateEdit(pkg, editId);
        return NextResponse.json({ ok: true });

      case "commit":
        needEdit();
        await commitEdit(pkg, editId);
        return NextResponse.json({ ok: true });

      case "discard":
        needEdit();
        await deleteEdit(pkg, editId);
        return NextResponse.json({ ok: true });

      default:
        throw new PlayError("Unknown action.", 400);
    }
  } catch (err) {
    const status = err instanceof PlayError ? err.status : 500;
    if (status >= 500) console.error("[play]", err);
    return NextResponse.json({ error: (err as Error).message || "Google Play request failed." }, { status });
  }
}
