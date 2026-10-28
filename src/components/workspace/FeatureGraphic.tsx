"use client";

import { forwardRef } from "react";
import type { UploadedScreenshot } from "@/lib/image";
import { LOCALE_MAP } from "@/lib/locales";
import { FEATURE_HEIGHT, FEATURE_WIDTH } from "@/lib/export";
import type { LocaleCode, Segment } from "@/lib/types";

interface Props {
  locale: LocaleCode;
  appName: string;
  headline: string;
  subheadline: string;
  screenshot: UploadedScreenshot | undefined;
  /** Picked regions of the first screenshot; the first becomes a floating badge. */
  segments: Segment[];
  backgroundDataUrl: string;
}

const PHONE_W = 138;
const PHONE_H = 290;
const BEZEL = 6;

/**
 * Google Play feature graphic, 1024 x 500 (rendered at 512 x 250 and exported at 2x).
 * Inline styles only, so html-to-image reproduces it exactly.
 */
export const FeatureGraphic = forwardRef<HTMLDivElement, Props>(function FeatureGraphic(
  { locale, appName, headline, subheadline, screenshot, segments, backgroundDataUrl },
  ref,
) {
  const rtl = LOCALE_MAP[locale]?.rtl ?? false;
  const textSide = rtl ? "right" : "left";
  const phoneSide = rtl ? "left" : "right";
  const badge = segments[0];

  return (
    <div
      ref={ref}
      dir={rtl ? "rtl" : "ltr"}
      style={{
        position: "relative",
        width: FEATURE_WIDTH,
        height: FEATURE_HEIGHT,
        overflow: "hidden",
        backgroundColor: "#111",
        fontFamily: "var(--font-plex-sans), system-ui, -apple-system, 'Segoe UI', sans-serif",
        color: "#fff",
        flex: "0 0 auto",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={backgroundDataUrl}
        alt=""
        draggable={false}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(${rtl ? "270deg" : "90deg"}, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.35) 48%, rgba(0,0,0,0) 75%)`,
        }}
      />

      {/* Copy */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          [textSide]: 30,
          width: 228,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          textAlign: rtl ? "right" : "left",
          zIndex: 3,
        }}
      >
        {appName && (
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, opacity: 0.85, letterSpacing: 0.2 }}>{appName}</p>
        )}
        <h3
          style={{
            margin: "6px 0 0",
            fontFamily: "inherit",
            fontVariationSettings: "normal",
            fontSize: 26,
            lineHeight: 1.08,
            fontWeight: 800,
            letterSpacing: rtl ? 0 : -0.4,
            textShadow: "0 3px 14px rgba(0,0,0,0.4)",
          }}
        >
          {headline}
        </h3>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 12.5,
            lineHeight: 1.4,
            opacity: 0.92,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {subheadline}
        </p>
      </div>

      {/* Phone */}
      {screenshot && (
        <div
          style={{
            position: "absolute",
            top: 34,
            [phoneSide]: 54,
            width: PHONE_W,
            height: PHONE_H,
            transform: `rotate(${rtl ? 7 : -7}deg)`,
            borderRadius: 24,
            background: "linear-gradient(160deg, #3a3a40, #0b0b0e)",
            padding: BEZEL,
            boxShadow: "0 24px 48px rgba(0,0,0,0.55)",
            zIndex: 2,
          }}
        >
          <div style={{ width: "100%", height: "100%", borderRadius: 24 - BEZEL, overflow: "hidden", background: "#000" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={screenshot.dataUrl}
              alt=""
              draggable={false}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", display: "block" }}
            />
          </div>
        </div>
      )}

      {/* Floating badge from the first picked region */}
      {screenshot && badge && (() => {
        const cardW = 124;
        const imgW = cardW / badge.bbox.w;
        const imgH = imgW / screenshot.aspect;
        const cardH = Math.min(76, badge.bbox.h * imgH);
        return (
          <div
            style={{
              position: "absolute",
              top: 150,
              [phoneSide]: 118,
              width: cardW,
              height: cardH,
              overflow: "hidden",
              borderRadius: 10,
              transform: `perspective(600px) rotateY(${rtl ? -14 : 14}deg) rotate(${rtl ? 3 : -3}deg)`,
              boxShadow: "0 18px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.25)",
              background: "#fff",
              zIndex: 4,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={screenshot.dataUrl}
              alt=""
              draggable={false}
              style={{
                position: "absolute",
                left: -badge.bbox.x * imgW,
                top: -badge.bbox.y * imgH,
                width: imgW,
                height: imgH,
                maxWidth: "none",
                display: "block",
              }}
            />
          </div>
        );
      })()}
    </div>
  );
});
