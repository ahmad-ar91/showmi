import type { LocaleCode, LocaleConfig } from "./types";

export const LOCALES: LocaleConfig[] = [
  {
    code: "en-US",
    playStoreCode: "en-US",
    label: "English (US)",
    nativeLabel: "English",
    flag: "🇺🇸",
    rtl: false,
    language: "English (United States)",
  },
  {
    code: "ja-JP",
    playStoreCode: "ja-JP",
    label: "Japanese",
    nativeLabel: "日本語",
    flag: "🇯🇵",
    rtl: false,
    language: "Japanese",
  },
  {
    code: "id-ID",
    playStoreCode: "id",
    label: "Indonesian",
    nativeLabel: "Bahasa Indonesia",
    flag: "🇮🇩",
    rtl: false,
    language: "Indonesian",
  },
  {
    code: "ar-SA",
    playStoreCode: "ar",
    label: "Arabic (RTL)",
    nativeLabel: "العربية",
    flag: "🇸🇦",
    rtl: true,
    language: "Modern Standard Arabic",
  },
  {
    code: "es-ES",
    playStoreCode: "es-ES",
    label: "Spanish",
    nativeLabel: "Español",
    flag: "🇪🇸",
    rtl: false,
    language: "Spanish (Spain)",
  },
];

export const LOCALE_MAP: Record<LocaleCode, LocaleConfig> = Object.fromEntries(
  LOCALES.map((l) => [l.code, l]),
) as Record<LocaleCode, LocaleConfig>;

export function isLocaleCode(value: unknown): value is LocaleCode {
  return typeof value === "string" && value in LOCALE_MAP;
}
