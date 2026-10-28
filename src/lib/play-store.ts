import "server-only";
import gplay from "google-play-scraper";

/** Normalised Google Play listing used by the analytics module. */
export interface StoreListing {
  appId: string;
  title: string;
  summary: string;
  description: string;
  score: number;
  ratings: number;
  installs: string;
  icon: string;
  screenshots: string[];
  developer: string;
  genre: string;
  url: string;
  /** "live" when scraped from Google Play just now, "sample" for the fictional demo apps. */
  source: "live" | "sample";
}

/** Accepts "com.foo.bar", a Play Store URL with ?id=, or surrounding whitespace. */
export function parseAppId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  const fromUrl = s.match(/[?&]id=([A-Za-z0-9._]+)/);
  if (fromUrl) return fromUrl[1];
  if (/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/.test(s)) return s;
  return null;
}

/** google-play-scraper returns HTML-escaped text for some fields. */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "");
}

interface GplayApp {
  appId: string;
  title: string;
  summary?: string;
  description?: string;
  score?: number;
  ratings?: number;
  installs?: string;
  icon?: string;
  screenshots?: string[];
  developer?: string;
  genre?: string;
  url?: string;
}

/** Fetches a listing from Google Play. */
export async function fetchListing(appId: string, opts: { lang?: string; country?: string } = {}): Promise<StoreListing> {
  try {
    const a = (await gplay.app({ appId, lang: opts.lang ?? "en", country: opts.country ?? "us" })) as GplayApp;
    return {
      appId: a.appId,
      title: decodeEntities(a.title),
      summary: decodeEntities(a.summary ?? ""),
      description: decodeEntities(a.description ?? ""),
      score: a.score ?? 0,
      ratings: a.ratings ?? 0,
      installs: a.installs ?? "",
      icon: a.icon ?? "",
      screenshots: (a.screenshots ?? []).slice(0, 6),
      developer: a.developer ?? "",
      genre: a.genre ?? "",
      url: a.url ?? `https://play.google.com/store/apps/details?id=${appId}`,
      source: "live",
    };
  } catch (err) {
    throw new Error(`Could not fetch "${appId}" from Google Play: ${(err as Error).message}`);
  }
}
