/**
 * Shared types for LocaLaunch AI.
 * Used by the API route, the Meta AI service layer, and the workspace UI.
 */

export type LocaleCode = "en-US" | "ja-JP" | "id-ID" | "ar-SA" | "es-ES";

export interface LocaleConfig {
  code: LocaleCode;
  /** Google Play / Fastlane folder name, e.g. "en-US", "ja-JP", "id", "ar", "es-ES". */
  playStoreCode: string;
  label: string;
  nativeLabel: string;
  flag: string;
  rtl: boolean;
  /** BCP-47 language tag passed to the model prompt. */
  language: string;
}

/** A UI element segmented out of a raw screenshot (SAM 3.1). */
export interface Segment {
  id: string;
  label: string;
  /** Normalised bounding box, 0..1 relative to the source screenshot. */
  bbox: { x: number; y: number; w: number; h: number };
  /** Model confidence 0..1. */
  score: number;
}

/** Google Play Console listing text. Limits are enforced in UI + prompt. */
export interface PlayStoreMetadata {
  /** max 30 chars */
  title: string;
  /** max 80 chars */
  shortDescription: string;
  /** max 4000 chars */
  fullDescription: string;
  keywords: string[];
}

export const PLAY_LIMITS = {
  title: 30,
  shortDescription: 80,
  fullDescription: 4000,
} as const;

/** Copy for one poster (one per screenshot) in a given locale. */
export interface PosterCopy {
  headline: string;
  subheadline: string;
}

export interface LocaleResult {
  locale: LocaleCode;
  metadata: PlayStoreMetadata;
  posters: PosterCopy[];
  /** Data URL (PNG/SVG/JPEG) of the Muse Image background. */
  backgroundDataUrl: string;
  /** Short note from Muse Spark on why the copy fits the market. */
  culturalNote: string;
}

export interface GenerateAsoRequest {
  appName?: string;
  description: string;
  /** Data URLs of 1-3 raw screenshots. */
  screenshots: string[];
  locales: LocaleCode[];
  /** Optional: segments the user picked per screenshot (same order). When present, SAM is skipped. */
  segments?: Segment[][];
  /** Optional: missing keywords to inject (hand-off from the ASO analytics tab). */
  keywords?: string[];
  /** Optional: weaknesses to fix (hand-off from the ASO analytics tab). */
  weaknesses?: string[];
}

export interface SegmentRequest {
  screenshot: string;
  index: number;
}

export interface SegmentResponse {
  mode: "mock" | "live";
  segments: Segment[];
  warning?: string;
}

export interface GenerateAsoResponse {
  mode: "mock" | "live";
  /** Segments per screenshot, same order as request.screenshots. */
  segments: Segment[][];
  locales: LocaleResult[];
  warnings: string[];
  generatedAt: string;
}

export type LayoutStyle = "classic" | "tilt" | "offset";
export type TextPosition = "top" | "bottom";
