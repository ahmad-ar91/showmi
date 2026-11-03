/**
 * Google Play Developer API (Android Publisher v3), the same edit workflow `fastlane supply` uses:
 * open an edit, update listings and images per language, validate, then commit or discard.
 *
 * Auth is a Google Cloud service account that the app owner has invited in Play Console
 * (Users and permissions) with permission to edit the store listing. The key is read from
 * GOOGLE_PLAY_SERVICE_ACCOUNT_FILE (a path) or GOOGLE_PLAY_SERVICE_ACCOUNT_JSON (the JSON itself),
 * and only packages listed in GOOGLE_PLAY_PACKAGES can be touched.
 */
import "server-only";
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

const API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";
const UPLOAD = "https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";

export type PlayImageType = "phoneScreenshots" | "featureGraphic";
export const PLAY_IMAGE_TYPES: PlayImageType[] = ["phoneScreenshots", "featureGraphic"];

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

export class PlayError extends Error {
  constructor(
    message: string,
    readonly status = 500,
  ) {
    super(message);
  }
}

function serviceAccount(): ServiceAccount | null {
  const inline = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON?.trim();
  const file = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_FILE?.trim();
  let raw = inline || "";
  if (!raw && file) {
    try {
      raw = readFileSync(file, "utf8");
    } catch {
      throw new PlayError("GOOGLE_PLAY_SERVICE_ACCOUNT_FILE points to a file that cannot be read.");
    }
  }
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as ServiceAccount;
    if (!sa.client_email || !sa.private_key) throw new Error();
    return sa;
  } catch {
    throw new PlayError("The Google Play service account key is not a valid service account JSON file.");
  }
}

export function allowedPackages(): string[] {
  return (process.env.GOOGLE_PLAY_PACKAGES ?? "")
    .split(/[\s,]+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** What the UI may know: whether publishing is set up, which account and which packages. */
export function playStatus(): { configured: boolean; serviceAccount: string | null; packages: string[]; error?: string } {
  try {
    const sa = serviceAccount();
    return { configured: !!sa && allowedPackages().length > 0, serviceAccount: sa?.client_email ?? null, packages: allowedPackages() };
  } catch (err) {
    return { configured: false, serviceAccount: null, packages: allowedPackages(), error: (err as Error).message };
  }
}

/* --------------------------------- Access token --------------------------------- */

let cached: { token: string; expires: number; email: string } | null = null;

const b64url = (data: string | Buffer) => Buffer.from(data).toString("base64url");

async function accessToken(): Promise<string> {
  const sa = serviceAccount();
  if (!sa) throw new PlayError("Google Play publishing is not set up on this server.", 503);
  if (cached && cached.email === sa.client_email && cached.expires > Date.now() + 60_000) return cached.token;

  const tokenUri = sa.token_uri || "https://oauth2.googleapis.com/token";
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: tokenUri, iat: now, exp: now + 3600 }));
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(sa.private_key).toString("base64url");

  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${header}.${claims}.${signature}` }),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string; error?: string };
  if (!res.ok || !data.access_token) {
    throw new PlayError(`Google sign-in for the service account failed: ${data.error_description || data.error || res.status}`, 502);
  }
  cached = { token: data.access_token, expires: Date.now() + (data.expires_in ?? 3600) * 1000, email: sa.client_email };
  return cached.token;
}

/* ----------------------------------- Requests ----------------------------------- */

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken()}`, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(50_000),
  });
  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: { message: text.slice(0, 200) } };
  }
  if (!res.ok) {
    const message = (data as { error?: { message?: string } }).error?.message || `HTTP ${res.status}`;
    throw new PlayError(`Google Play: ${message}`, res.status === 401 || res.status === 403 ? 403 : 502);
  }
  return data as T;
}

const app = (pkg: string) => `${API}/${encodeURIComponent(pkg)}`;
const edit = (pkg: string, editId: string) => `${app(pkg)}/edits/${encodeURIComponent(editId)}`;

export async function openEdit(pkg: string): Promise<string> {
  const data = await call<{ id: string }>(`${app(pkg)}/edits`, { method: "POST" });
  return data.id;
}

export async function updateListing(
  pkg: string,
  editId: string,
  language: string,
  listing: { title: string; shortDescription: string; fullDescription: string },
): Promise<void> {
  await call(`${edit(pkg, editId)}/listings/${encodeURIComponent(language)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language, ...listing }),
  });
}

/** Removes every image of one type for one language, so uploads replace rather than append. */
export async function clearImages(pkg: string, editId: string, language: string, type: PlayImageType): Promise<void> {
  await call(`${edit(pkg, editId)}/listings/${encodeURIComponent(language)}/${type}`, { method: "DELETE" });
}

export async function uploadImage(
  pkg: string,
  editId: string,
  language: string,
  type: PlayImageType,
  bytes: ArrayBuffer,
  mime: string,
): Promise<void> {
  const url = `${UPLOAD}/${encodeURIComponent(pkg)}/edits/${encodeURIComponent(editId)}/listings/${encodeURIComponent(language)}/${type}?uploadType=media`;
  await call(url, { method: "POST", headers: { "Content-Type": mime }, body: bytes });
}

/** Checks the edit without publishing it. */
export async function validateEdit(pkg: string, editId: string): Promise<void> {
  await call(`${edit(pkg, editId)}:validate`, { method: "POST" });
}

/** Publishes the edit; store listing changes then go through Google's review. */
export async function commitEdit(pkg: string, editId: string): Promise<void> {
  await call(`${edit(pkg, editId)}:commit`, { method: "POST" });
}

/** Throws the edit away without changing anything on Google Play. */
export async function deleteEdit(pkg: string, editId: string): Promise<void> {
  await call(`${edit(pkg, editId)}`, { method: "DELETE" });
}
