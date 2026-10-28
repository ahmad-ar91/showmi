import type { LocaleCode, LocaleConfig, LocaleRegion } from "./types";

/**
 * Markets supported by Google Play Console. `playStoreCode` is the folder name Fastlane
 * `supply` expects under fastlane/metadata/android/. Add a market by appending one entry.
 */
type Row = [code: string, playStoreCode: string, label: string, nativeLabel: string, flag: string, language: string, rtl?: boolean];

const REGIONS: Record<LocaleRegion, Row[]> = {
  Americas: [
    ["en-US", "en-US", "English (US)", "English", "🇺🇸", "English (United States)"],
    ["en-CA", "en-CA", "English (Canada)", "English", "🇨🇦", "English (Canada)"],
    ["fr-CA", "fr-CA", "French (Canada)", "Français (Canada)", "🇨🇦", "Canadian French"],
    ["es-US", "es-US", "Spanish (US)", "Español (EE. UU.)", "🇺🇸", "US Spanish"],
    ["es-419", "es-419", "Spanish (Latin America)", "Español (Latinoamérica)", "🇲🇽", "Latin American Spanish"],
    ["pt-BR", "pt-BR", "Portuguese (Brazil)", "Português (Brasil)", "🇧🇷", "Brazilian Portuguese"],
  ],
  Europe: [
    ["en-GB", "en-GB", "English (UK)", "English", "🇬🇧", "British English"],
    ["de-DE", "de-DE", "German", "Deutsch", "🇩🇪", "German"],
    ["fr-FR", "fr-FR", "French", "Français", "🇫🇷", "French (France)"],
    ["es-ES", "es-ES", "Spanish (Spain)", "Español", "🇪🇸", "Spanish (Spain)"],
    ["it-IT", "it-IT", "Italian", "Italiano", "🇮🇹", "Italian"],
    ["pt-PT", "pt-PT", "Portuguese (Portugal)", "Português", "🇵🇹", "European Portuguese"],
    ["nl-NL", "nl-NL", "Dutch", "Nederlands", "🇳🇱", "Dutch"],
    ["pl-PL", "pl-PL", "Polish", "Polski", "🇵🇱", "Polish"],
    ["sv-SE", "sv-SE", "Swedish", "Svenska", "🇸🇪", "Swedish"],
    ["da-DK", "da-DK", "Danish", "Dansk", "🇩🇰", "Danish"],
    ["no-NO", "no-NO", "Norwegian", "Norsk", "🇳🇴", "Norwegian Bokmål"],
    ["fi-FI", "fi-FI", "Finnish", "Suomi", "🇫🇮", "Finnish"],
    ["cs-CZ", "cs-CZ", "Czech", "Čeština", "🇨🇿", "Czech"],
    ["sk-SK", "sk", "Slovak", "Slovenčina", "🇸🇰", "Slovak"],
    ["hu-HU", "hu-HU", "Hungarian", "Magyar", "🇭🇺", "Hungarian"],
    ["ro-RO", "ro", "Romanian", "Română", "🇷🇴", "Romanian"],
    ["bg-BG", "bg", "Bulgarian", "Български", "🇧🇬", "Bulgarian"],
    ["hr-HR", "hr", "Croatian", "Hrvatski", "🇭🇷", "Croatian"],
    ["sr-RS", "sr", "Serbian", "Српски", "🇷🇸", "Serbian (Cyrillic)"],
    ["sl-SI", "sl", "Slovenian", "Slovenščina", "🇸🇮", "Slovenian"],
    ["el-GR", "el-GR", "Greek", "Ελληνικά", "🇬🇷", "Greek"],
    ["uk-UA", "uk", "Ukrainian", "Українська", "🇺🇦", "Ukrainian"],
    ["ru-RU", "ru-RU", "Russian", "Русский", "🇷🇺", "Russian"],
    ["tr-TR", "tr-TR", "Turkish", "Türkçe", "🇹🇷", "Turkish"],
    ["lt-LT", "lt", "Lithuanian", "Lietuvių", "🇱🇹", "Lithuanian"],
    ["lv-LV", "lv", "Latvian", "Latviešu", "🇱🇻", "Latvian"],
    ["et-EE", "et", "Estonian", "Eesti", "🇪🇪", "Estonian"],
  ],
  "Middle East & Africa": [
    ["ar-SA", "ar", "Arabic", "العربية", "🇸🇦", "Modern Standard Arabic", true],
    ["he-IL", "iw-IL", "Hebrew", "עברית", "🇮🇱", "Hebrew", true],
    ["fa-IR", "fa", "Persian", "فارسی", "🇮🇷", "Persian (Farsi)", true],
    ["en-ZA", "en-ZA", "English (South Africa)", "English", "🇿🇦", "South African English"],
    ["af-ZA", "af", "Afrikaans", "Afrikaans", "🇿🇦", "Afrikaans"],
    ["zu-ZA", "zu", "Zulu", "isiZulu", "🇿🇦", "Zulu"],
    ["sw-KE", "sw", "Swahili", "Kiswahili", "🇰🇪", "Swahili"],
    ["am-ET", "am", "Amharic", "አማርኛ", "🇪🇹", "Amharic"],
  ],
  "Asia Pacific": [
    ["ja-JP", "ja-JP", "Japanese", "日本語", "🇯🇵", "Japanese"],
    ["ko-KR", "ko-KR", "Korean", "한국어", "🇰🇷", "Korean"],
    ["zh-CN", "zh-CN", "Chinese (Simplified)", "简体中文", "🇨🇳", "Simplified Chinese (Mainland China)"],
    ["zh-TW", "zh-TW", "Chinese (Traditional)", "繁體中文", "🇹🇼", "Traditional Chinese (Taiwan)"],
    ["zh-HK", "zh-HK", "Chinese (Hong Kong)", "繁體中文（香港）", "🇭🇰", "Traditional Chinese (Hong Kong)"],
    ["id-ID", "id", "Indonesian", "Bahasa Indonesia", "🇮🇩", "Indonesian"],
    ["ms-MY", "ms-MY", "Malay", "Bahasa Melayu", "🇲🇾", "Malay (Malaysia)"],
    ["th-TH", "th", "Thai", "ไทย", "🇹🇭", "Thai"],
    ["vi-VN", "vi", "Vietnamese", "Tiếng Việt", "🇻🇳", "Vietnamese"],
    ["fil-PH", "fil", "Filipino", "Filipino", "🇵🇭", "Filipino (Tagalog)"],
    ["hi-IN", "hi-IN", "Hindi", "हिन्दी", "🇮🇳", "Hindi"],
    ["en-IN", "en-IN", "English (India)", "English", "🇮🇳", "Indian English"],
    ["bn-BD", "bn-BD", "Bengali", "বাংলা", "🇧🇩", "Bengali"],
    ["ta-IN", "ta-IN", "Tamil", "தமிழ்", "🇮🇳", "Tamil"],
    ["te-IN", "te-IN", "Telugu", "తెలుగు", "🇮🇳", "Telugu"],
    ["mr-IN", "mr-IN", "Marathi", "मराठी", "🇮🇳", "Marathi"],
    ["ur-PK", "ur", "Urdu", "اردو", "🇵🇰", "Urdu", true],
    ["ne-NP", "ne-NP", "Nepali", "नेपाली", "🇳🇵", "Nepali"],
    ["si-LK", "si-LK", "Sinhala", "සිංහල", "🇱🇰", "Sinhala"],
    ["km-KH", "km-KH", "Khmer", "ខ្មែរ", "🇰🇭", "Khmer"],
    ["my-MM", "my-MM", "Burmese", "မြန်မာ", "🇲🇲", "Burmese"],
    ["kk-KZ", "kk", "Kazakh", "Қазақ", "🇰🇿", "Kazakh"],
    ["en-AU", "en-AU", "English (Australia)", "English", "🇦🇺", "Australian English"],
    ["en-SG", "en-SG", "English (Singapore)", "English", "🇸🇬", "Singapore English"],
  ],
};

export const LOCALE_REGIONS = Object.keys(REGIONS) as LocaleRegion[];

export const LOCALES: LocaleConfig[] = LOCALE_REGIONS.flatMap((region) =>
  REGIONS[region].map(([code, playStoreCode, label, nativeLabel, flag, language, rtl = false]) => ({
    code,
    playStoreCode,
    label,
    nativeLabel,
    flag,
    rtl,
    language,
    region,
  })),
);

export const LOCALE_MAP: Record<LocaleCode, LocaleConfig> = Object.fromEntries(LOCALES.map((l) => [l.code, l]));

export function isLocaleCode(value: unknown): value is LocaleCode {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(LOCALE_MAP, value);
}

/** Lower-cased text used to match a market against a search query. */
export function localeSearchText(l: LocaleConfig): string {
  return `${l.label} ${l.nativeLabel} ${l.code} ${l.playStoreCode} ${l.region}`.toLowerCase();
}
