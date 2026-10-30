"use client";

import { forwardRef } from "react";
import type { UploadedScreenshot } from "@/lib/image";
import { MAX_CALLOUTS } from "@/lib/creative-rules";
import { LOCALE_MAP } from "@/lib/locales";
import { POSTER_HEIGHT, POSTER_WIDTH } from "@/lib/export";
import type { LayoutStyle, LocaleCode, PosterCopy, Segment, TextPosition } from "@/lib/types";

interface Props {
  locale: LocaleCode;
  screenshot: UploadedScreenshot;
  segments: Segment[];
  copy: PosterCopy;
  backgroundDataUrl: string;
  layout: LayoutStyle;
  textPosition: TextPosition;
}

/* Phone mockup geometry (CSS px inside the 360x640 poster). */
const PHONE_W = 206;
const PHONE_H = 446;
const BEZEL = 8;

/**
 * A 9:16 poster rendered entirely with inline styles so that html-to-image
 * produces a pixel-identical PNG at 3x (1080x1920).
 */
export const PosterCanvas = forwardRef<HTMLDivElement, Props>(function PosterCanvas(
  { locale, screenshot, segments, copy, backgroundDataUrl, layout, textPosition },
  ref,
) {
  const loc = LOCALE_MAP[locale];
  const rtl = loc.rtl;
  const textTop = textPosition === "top";

  // Layout presets ---------------------------------------------------------
  const phoneTransform = {
    classic: "translateX(-50%)",
    tilt: "translateX(-50%) rotate(-7deg) scale(0.96)",
    offset: `translateX(${rtl ? "-82%" : "-18%"}) rotate(${rtl ? "4deg" : "-4deg"})`,
  }[layout];

  const phoneTop = textTop ? 158 : 36;
  const phoneLeft = 180; // centre
  const phoneExtra = layout === "offset" ? 50 : 0;

  // Floating 3D badge placement per layout (relative to poster). Alternate sides, up to MAX_CALLOUTS.
  // Narrow cards hug the poster edge so they cover at most a quarter of the phone screen.
  const badges = segments.slice(0, MAX_CALLOUTS);
  const cardWidth = 124;
  const cardPositions = badges.map((_, i) => {
    const leftSide = rtl ? i % 2 === 1 : i % 2 === 0;
    const baseY = textTop ? 225 : 105;
    const stepY = 200;
    // 3D tilt: badges on the left face slightly right and vice-versa, like cards peeling off the screen.
    const yaw = leftSide ? 16 : -16;
    if (layout === "offset") {
      const x = rtl ? 196 - (i % 2) * 16 : 14 + (i % 2) * 16;
      return { left: x, top: baseY + i * stepY, rotate: rtl ? 3 : -3, yaw: rtl ? -14 : 14 };
    }
    return {
      left: leftSide ? 8 : POSTER_WIDTH - cardWidth - 8,
      top: baseY + i * stepY,
      rotate: layout === "tilt" ? (leftSide ? -5 : 5) : 0,
      yaw,
    };
  });

  const textBlockStyle: React.CSSProperties = {
    position: "absolute",
    left: 24,
    right: 24,
    ...(textTop ? { top: 44 } : { bottom: 44 }),
    textAlign: "center",
    direction: rtl ? "rtl" : "ltr",
    zIndex: 5,
  };

  return (
    <div
      ref={ref}
      dir={rtl ? "rtl" : "ltr"}
      style={{
        position: "relative",
        width: POSTER_WIDTH,
        height: POSTER_HEIGHT,
        overflow: "hidden",
        borderRadius: 18,
        backgroundColor: "#111",
        fontFamily: "var(--font-plex-sans), system-ui, -apple-system, 'Segoe UI', sans-serif",
        color: "#fff",
        flex: "0 0 auto",
      }}
    >
      {/* (a) Background from Muse Image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={backgroundDataUrl}
        alt=""
        draggable={false}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />
      {/* Legibility scrim */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: textTop
            ? "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.25) 100%)"
            : "linear-gradient(0deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.15) 100%)",
        }}
      />

      {/* (b) Localized headline & sub-headline */}
      <div style={textBlockStyle}>
        <h3
          style={{
            margin: 0,
            // The app styles h3 with its serif display face; posters keep the bold sans.
            fontFamily: "inherit",
            fontVariationSettings: "normal",
            fontSize: 30,
            lineHeight: 1.1,
            fontWeight: 800,
            letterSpacing: rtl ? 0 : -0.5,
            textShadow: "0 4px 18px rgba(0,0,0,0.45)",
            wordBreak: "break-word",
          }}
        >
          {copy.headline}
        </h3>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 14,
            lineHeight: 1.35,
            opacity: 0.92,
            textShadow: "0 2px 10px rgba(0,0,0,0.45)",
          }}
        >
          {copy.subheadline}
        </p>
      </div>

      {/* (c) Phone mockup */}
      <div
        style={{
          position: "absolute",
          left: phoneLeft,
          top: phoneTop + phoneExtra,
          width: PHONE_W,
          height: PHONE_H,
          transform: phoneTransform,
          transformOrigin: "50% 50%",
          borderRadius: 34,
          background: "linear-gradient(160deg, #3a3a40, #0b0b0e)",
          padding: BEZEL,
          boxShadow: "0 30px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08) inset",
          zIndex: 2,
        }}
      >
        {/* Side buttons */}
        <div style={{ position: "absolute", left: -3, top: 90, width: 3, height: 26, borderRadius: 2, background: "#2a2a2e" }} />
        <div style={{ position: "absolute", left: -3, top: 128, width: 3, height: 44, borderRadius: 2, background: "#2a2a2e" }} />
        <div style={{ position: "absolute", right: -3, top: 110, width: 3, height: 64, borderRadius: 2, background: "#2a2a2e" }} />
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: 34 - BEZEL,
            overflow: "hidden",
            background: "#000",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={screenshot.dataUrl}
            alt=""
            draggable={false}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", display: "block" }}
          />
          {/* Punch-hole camera */}
          <div
            style={{
              position: "absolute",
              top: 10,
              left: "50%",
              width: 12,
              height: 12,
              marginLeft: -6,
              borderRadius: 999,
              background: "#000",
              boxShadow: "0 0 0 2px rgba(255,255,255,0.08)",
            }}
          />
        </div>
      </div>

      {/* (d) Floating 3D badges: UI regions picked from SAM 3.1 segments */}
      {badges.map((seg, i) => {
        const pos = cardPositions[i];
        const scale = cardWidth / seg.bbox.w; // image rendered width in px
        const imgW = scale;
        const imgH = scale / screenshot.aspect;
        const cardH = seg.bbox.h * imgH;
        return (
          <div
            key={seg.id}
            style={{
              position: "absolute",
              left: pos.left,
              top: pos.top,
              width: cardWidth,
              height: cardH,
              overflow: "hidden",
              borderRadius: 12,
              transform: `perspective(700px) rotateY(${pos.yaw}deg) rotateX(6deg) rotate(${pos.rotate}deg)`,
              transformOrigin: "50% 50%",
              boxShadow:
                "0 30px 50px rgba(0,0,0,0.6), 0 10px 18px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.22), inset 0 1px 0 rgba(255,255,255,0.5)",
              background: "#fff",
              zIndex: 4 + i,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={screenshot.dataUrl}
              alt=""
              draggable={false}
              style={{
                position: "absolute",
                left: -seg.bbox.x * imgW,
                top: -seg.bbox.y * imgH,
                width: imgW,
                height: imgH,
                maxWidth: "none",
                display: "block",
              }}
            />
          </div>
        );
      })}
    </div>
  );
});
