import "server-only";
import { LOCALE_MAP } from "./locales";
import type {
  GenerateAsoRequest,
  GenerateAsoResponse,
  LocaleCode,
  LocaleResult,
  PlayStoreMetadata,
  PosterCopy,
  Segment,
} from "./types";
import { PLAY_LIMITS } from "./types";
import { truncateChars } from "./utils";

/* -------------------------------------------------------------------------- */
/*  Configuration                                                              */
/* -------------------------------------------------------------------------- */

export interface MetaConfig {
  apiKey: string | undefined;
  baseUrl: string;
  mock: boolean;
  models: {
    sam: string;
    spark: string;
    image: string;
  };
}

export function getMetaConfig(): MetaConfig {
  const apiKey = process.env.META_API_KEY?.trim() || undefined;
  const forcedMock = process.env.MOCK_MODE === "true";
  return {
    apiKey,
    baseUrl: (process.env.META_API_BASE_URL || "https://api.llama.com/v1").replace(/\/$/, ""),
    // Mock whenever explicitly requested OR when no API key is configured.
    mock: forcedMock || !apiKey,
    models: {
      sam: process.env.META_SAM_MODEL || "sam-3.1",
      spark: process.env.META_SPARK_MODEL || "muse-spark",
      image: process.env.META_IMAGE_MODEL || "muse-image",
    },
  };
}

export function isMockMode(): boolean {
  return getMetaConfig().mock;
}

/* -------------------------------------------------------------------------- */
/*  Low-level HTTP helpers (live mode)                                         */
/* -------------------------------------------------------------------------- */

async function metaFetch<T>(path: string, body: unknown, cfg: MetaConfig): Promise<T> {
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(body),
    // Never let Next.js cache model calls.
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Meta API ${path} failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** Download a remote image and convert it to a data URL so the client canvas can embed it. */
async function toDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch image ${res.status}`);
  const mime = res.headers.get("content-type") || "image/png";
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:${mime};base64,${buf.toString("base64")}`;
}

function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  return JSON.parse(raw.slice(start, end + 1)) as T;
}

/* -------------------------------------------------------------------------- */
/*  1. SAM 3.1 - UI element segmentation                                       */
/* -------------------------------------------------------------------------- */

export async function segmentScreenshot(
  screenshotDataUrl: string,
  index: number,
  cfg: MetaConfig = getMetaConfig(),
): Promise<Segment[]> {
  if (cfg.mock) return mockSegments(index);

  interface SamResponse {
    masks?: { label?: string; score?: number; bbox: [number, number, number, number] }[];
  }
  const data = await metaFetch<SamResponse>(
    "/segment",
    {
      model: cfg.models.sam,
      image: screenshotDataUrl,
      prompt:
        "Segment the most important interactive UI elements: hero card, primary button, key stat widget, list item.",
      max_masks: 3,
    },
    cfg,
  );

  const masks = data.masks ?? [];
  if (!masks.length) return mockSegments(index);
  return masks.slice(0, 3).map((m, i) => ({
    id: `s${index}-seg${i}`,
    label: m.label || `Element ${i + 1}`,
    score: m.score ?? 0.9,
    bbox: { x: m.bbox[0], y: m.bbox[1], w: m.bbox[2], h: m.bbox[3] },
  }));
}

/**
 * Realistic fallback: four candidate UI regions per screenshot in typical mobile UI zones.
 * The user picks which of them become floating badges in the Segment Picker.
 */
function mockSegments(index: number): Segment[] {
  const presets: Omit<Segment, "id">[][] = [
    [
      { label: "Hero Card", score: 0.97, bbox: { x: 0.07, y: 0.16, w: 0.86, h: 0.2 } },
      { label: "Stats Widget", score: 0.93, bbox: { x: 0.08, y: 0.3, w: 0.84, h: 0.17 } },
      { label: "Notification", score: 0.9, bbox: { x: 0.07, y: 0.55, w: 0.86, h: 0.12 } },
      { label: "Primary Button", score: 0.94, bbox: { x: 0.1, y: 0.8, w: 0.8, h: 0.085 } },
    ],
    [
      { label: "Chart Card", score: 0.96, bbox: { x: 0.08, y: 0.3, w: 0.84, h: 0.17 } },
      { label: "Top Banner", score: 0.9, bbox: { x: 0.07, y: 0.16, w: 0.86, h: 0.2 } },
      { label: "List Item", score: 0.91, bbox: { x: 0.07, y: 0.55, w: 0.86, h: 0.12 } },
      { label: "CTA Button", score: 0.92, bbox: { x: 0.1, y: 0.8, w: 0.8, h: 0.085 } },
    ],
    [
      { label: "Summary Card", score: 0.95, bbox: { x: 0.07, y: 0.16, w: 0.86, h: 0.2 } },
      { label: "Progress Ring", score: 0.92, bbox: { x: 0.3, y: 0.3, w: 0.4, h: 0.17 } },
      { label: "Activity Row", score: 0.89, bbox: { x: 0.07, y: 0.55, w: 0.86, h: 0.12 } },
      { label: "Action Chip", score: 0.9, bbox: { x: 0.3, y: 0.8, w: 0.4, h: 0.085 } },
    ],
  ];
  return presets[index % presets.length].map((s, i) => ({ ...s, id: `s${index}-seg${i}` }));
}

/** Segment one screenshot, degrading to the simulated detector if the live call fails. */
export async function segmentWithFallback(
  screenshotDataUrl: string,
  index: number,
): Promise<{ segments: Segment[]; mode: "mock" | "live"; warning?: string }> {
  const cfg = getMetaConfig();
  if (cfg.mock) return { segments: mockSegments(index), mode: "mock" };
  try {
    return { segments: await segmentScreenshot(screenshotDataUrl, index, cfg), mode: "live" };
  } catch (err) {
    return {
      segments: mockSegments(index),
      mode: "mock",
      warning: `SAM 3.1 (screenshot ${index + 1}): ${(err as Error).message} (used simulated output)`,
    };
  }
}

/* -------------------------------------------------------------------------- */
/*  2. Muse Spark - multilingual ASO metadata (JSON)                            */
/* -------------------------------------------------------------------------- */

export interface SparkOutput {
  metadata: PlayStoreMetadata;
  posters: PosterCopy[];
  culturalNote: string;
}

export async function generateLocaleMetadata(
  params: {
    appName: string;
    description: string;
    locale: LocaleCode;
    screenshots: string[];
  },
  cfg: MetaConfig = getMetaConfig(),
): Promise<SparkOutput> {
  if (cfg.mock) return mockSpark(params);

  const loc = LOCALE_MAP[params.locale];
  const n = params.screenshots.length;
  const system = `You are an expert App Store Optimization (ASO) copywriter and cultural localizer.
Return ONLY valid JSON matching this TypeScript type:
{
  "metadata": {
    "title": string,            // Google Play title, MAX ${PLAY_LIMITS.title} characters
    "shortDescription": string, // MAX ${PLAY_LIMITS.shortDescription} characters
    "fullDescription": string,  // MAX ${PLAY_LIMITS.fullDescription} characters, use paragraphs + bullet-like lines
    "keywords": string[]        // 5-8 locale-native search keywords
  },
  "posters": { "headline": string, "subheadline": string }[], // exactly ${n} entries, one per screenshot, headline <= 28 chars, subheadline <= 60 chars
  "culturalNote": string        // one sentence on cultural adaptation choices
}
All text must be written natively in ${loc.language} (not a literal translation), using local idioms and tone. ${loc.rtl ? "The language is right-to-left." : ""}`;

  const content: unknown[] = [
    {
      type: "text",
      text: `App name: ${params.appName}\nApp description: ${params.description}\nTarget market: ${loc.label} (${loc.code}).\nAnalyse the attached screenshots and write the listing + poster copy.`,
    },
    ...params.screenshots.map((url) => ({ type: "image_url", image_url: { url } })),
  ];

  interface ChatResponse {
    choices?: { message?: { content?: string } }[];
    completion_message?: { content?: { text?: string } | string };
  }
  const data = await metaFetch<ChatResponse>(
    "/chat/completions",
    {
      model: cfg.models.spark,
      messages: [
        { role: "system", content: system },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    },
    cfg,
  );

  const text =
    data.choices?.[0]?.message?.content ??
    (typeof data.completion_message?.content === "string"
      ? data.completion_message.content
      : data.completion_message?.content?.text) ??
    "";
  const parsed = extractJson<SparkOutput>(text);
  return enforceLimits(parsed, n);
}

function enforceLimits(out: SparkOutput, screenshotCount: number): SparkOutput {
  const posters = [...(out.posters ?? [])];
  while (posters.length < screenshotCount) {
    posters.push(posters[posters.length - 1] ?? { headline: "", subheadline: "" });
  }
  return {
    metadata: {
      title: truncateChars(out.metadata?.title ?? "", PLAY_LIMITS.title),
      shortDescription: truncateChars(out.metadata?.shortDescription ?? "", PLAY_LIMITS.shortDescription),
      fullDescription: truncateChars(out.metadata?.fullDescription ?? "", PLAY_LIMITS.fullDescription),
      keywords: out.metadata?.keywords ?? [],
    },
    posters: posters.slice(0, screenshotCount),
    culturalNote: out.culturalNote ?? "",
  };
}

/* ----------------------------- Mock copy bank ----------------------------- */

type CopyBank = Record<
  LocaleCode,
  {
    titleSuffix: string;
    short: (app: string) => string;
    full: (app: string, desc: string) => string;
    posters: PosterCopy[];
    keywords: string[];
    note: string;
  }
>;

const COPY_BANK: CopyBank = {
  "en-US": {
    titleSuffix: "– Plan & Track",
    short: (app) => `${app}: plan smarter, track progress, and hit every goal.`,
    full: (app, desc) =>
      `${app} is built to make every day feel organized and effortless.\n\n${desc}\n\nWHY PEOPLE LOVE ${app.toUpperCase()}\n• Clean, distraction-free design that gets out of your way\n• Smart reminders that adapt to your routine\n• Beautiful progress insights at a glance\n• Works offline, syncs when you are back online\n\nBUILT FOR YOUR LIFE\nWhether you are a student, a busy parent, or running a team, ${app} keeps the important things front and center.\n\nPRIVACY FIRST\nYour data stays yours. No ads, no selling your information.\n\nDownload ${app} today and start your best week yet.`,
    posters: [
      { headline: "Own your day", subheadline: "Everything you need, one tap away" },
      { headline: "See progress clearly", subheadline: "Insights that keep you motivated" },
      { headline: "Stay in sync", subheadline: "Reminders that fit your routine" },
    ],
    keywords: ["planner", "productivity", "habit tracker", "to-do list", "goals"],
    note: "Direct, benefit-led US tone with action verbs and an upbeat CTA.",
  },
  "ja-JP": {
    titleSuffix: "- 毎日をもっと快適に",
    short: (app) => `${app}で予定も目標もスッキリ管理。続けやすさにこだわりました。`,
    full: (app, desc) =>
      `${app}は、忙しい毎日をやさしく整えるアプリです。\n\n${desc}\n\n【${app}の特長】\n・シンプルで見やすいデザイン\n・生活リズムに合わせた賢いリマインダー\n・ひと目でわかる進捗グラフ\n・オフラインでも使える安心設計\n\n【こんな方におすすめ】\n学生の方、子育て中の方、チームで働く方まで。${app}が大切なことを忘れずにサポートします。\n\n【プライバシーを大切に】\n広告なし。あなたのデータを第三者に販売することはありません。\n\nまずは無料でダウンロードして、新しい習慣を始めましょう。`,
    posters: [
      { headline: "毎日を、もっと自分らしく", subheadline: "必要なことは、すべてワンタップで" },
      { headline: "進捗がひと目でわかる", subheadline: "続けたくなるインサイト" },
      { headline: "忘れない、迷わない", subheadline: "生活に寄り添うリマインダー" },
    ],
    keywords: ["手帳", "タスク管理", "習慣化", "ToDo", "目標達成"],
    note: "Polite, reassuring Japanese tone emphasising continuity (続けやすさ) and gentle support.",
  },
  "id-ID": {
    titleSuffix: "- Atur Hari Lebih Rapi",
    short: (app) => `${app}: atur jadwal, pantau progres, capai target tanpa ribet.`,
    full: (app, desc) =>
      `${app} hadir untuk membuat harimu lebih teratur dan ringan.\n\n${desc}\n\nKENAPA PILIH ${app.toUpperCase()}?\n• Tampilan bersih dan gampang dipakai\n• Pengingat pintar yang menyesuaikan rutinitasmu\n• Grafik progres yang bikin semangat\n• Tetap jalan tanpa internet, sinkron otomatis saat online\n\nCOCOK UNTUK SIAPA SAJA\nMahasiswa, orang tua yang sibuk, sampai tim kerja, ${app} bantu kamu fokus ke hal yang penting.\n\nPRIVASI TERJAGA\nTanpa iklan. Datamu tidak pernah dijual ke pihak lain.\n\nUnduh ${app} sekarang, gratis, dan mulai minggu terbaikmu!`,
    posters: [
      { headline: "Harimu, lebih teratur", subheadline: "Semua yang kamu butuh, cukup sekali tap" },
      { headline: "Progres jelas terlihat", subheadline: "Insight yang bikin kamu makin semangat" },
      { headline: "Nggak ada yang terlewat", subheadline: "Pengingat yang pas dengan rutinitasmu" },
    ],
    keywords: ["pengatur jadwal", "produktivitas", "catatan tugas", "to do list", "kebiasaan"],
    note: "Casual, friendly Indonesian (kamu) with gratis + anti-ribet hooks that resonate locally.",
  },
  "ar-SA": {
    titleSuffix: "- نظّم يومك بسهولة",
    short: (app) => `${app}: خطّط بذكاء، تابع تقدّمك، وحقّق أهدافك كل يوم.`,
    full: (app, desc) =>
      `${app} صُمّم ليجعل يومك أكثر تنظيمًا وراحة.\n\n${desc}\n\nلماذا ${app}؟\n• تصميم أنيق وبسيط يناسب اللغة العربية\n• تذكيرات ذكية تتكيّف مع روتينك\n• رسوم بيانية واضحة لمتابعة تقدّمك\n• يعمل بدون إنترنت ويزامن بياناتك تلقائيًا\n\nمناسب للجميع\nطالبًا كنت، أو أبًا مشغولًا، أو تدير فريقًا، ${app} يُبقي الأهم أمام عينيك دائمًا.\n\nخصوصيتك أولًا\nبدون إعلانات، ولا نبيع بياناتك أبدًا.\n\nحمّل ${app} الآن مجانًا وابدأ أسبوعك الأفضل.`,
    posters: [
      { headline: "يومك بين يديك", subheadline: "كل ما تحتاجه بلمسة واحدة" },
      { headline: "تقدّمك واضح", subheadline: "رؤى تحفّزك على الاستمرار" },
      { headline: "لا تفوّت شيئًا", subheadline: "تذكيرات تناسب روتينك" },
    ],
    keywords: ["منظم المهام", "الإنتاجية", "قائمة المهام", "تتبع العادات", "الأهداف"],
    note: "Formal-yet-warm Modern Standard Arabic, RTL layout, family and reliability cues valued in the Gulf market.",
  },
  "es-ES": {
    titleSuffix: "- Organiza tu día",
    short: (app) => `${app}: planifica, sigue tu progreso y cumple tus metas cada día.`,
    full: (app, desc) =>
      `${app} está diseñada para que cada día sea más ordenado y sencillo.\n\n${desc}\n\n¿POR QUÉ ${app.toUpperCase()}?\n• Diseño limpio y sin distracciones\n• Recordatorios inteligentes que se adaptan a tu rutina\n• Estadísticas de progreso que motivan\n• Funciona sin conexión y sincroniza al volver\n\nPENSADA PARA TU VIDA\nEstudiantes, familias ocupadas o equipos de trabajo: ${app} mantiene lo importante siempre a la vista.\n\nTU PRIVACIDAD, PRIMERO\nSin anuncios. Nunca vendemos tus datos.\n\nDescarga ${app} gratis y empieza tu mejor semana.`,
    posters: [
      { headline: "Tu día, bajo control", subheadline: "Todo lo que necesitas en un toque" },
      { headline: "Progreso a la vista", subheadline: "Datos que te motivan a seguir" },
      { headline: "Nada se te escapa", subheadline: "Recordatorios a tu ritmo" },
    ],
    keywords: ["agenda", "productividad", "lista de tareas", "hábitos", "objetivos"],
    note: "Peninsular Spanish with tú form, concise benefit statements and a free-download CTA.",
  },
};

function mockSpark(params: {
  appName: string;
  description: string;
  locale: LocaleCode;
  screenshots: string[];
}): SparkOutput {
  const bank = COPY_BANK[params.locale];
  const app = params.appName;
  const desc = params.description.trim() || "An app that helps you get things done.";
  return enforceLimits(
    {
      metadata: {
        title: `${app} ${bank.titleSuffix}`,
        shortDescription: bank.short(app),
        fullDescription: bank.full(app, desc),
        keywords: bank.keywords,
      },
      posters: bank.posters,
      culturalNote: bank.note,
    },
    params.screenshots.length,
  );
}

/* -------------------------------------------------------------------------- */
/*  3. Muse Image - culturally-aware poster backgrounds                        */
/* -------------------------------------------------------------------------- */

export async function generateBackground(
  params: { locale: LocaleCode; description: string },
  cfg: MetaConfig = getMetaConfig(),
): Promise<string> {
  if (cfg.mock) return mockBackground(params.locale);

  const loc = LOCALE_MAP[params.locale];
  const prompt = `Abstract, premium app-store poster background for a mobile app (${params.description.slice(0, 120)}). Vertical 9:16, soft gradient, subtle cultural motif inspired by ${loc.label}, no text, no people, no logos, lots of negative space in the centre for a phone mockup.`;

  interface ImageResponse {
    data?: { url?: string; b64_json?: string }[];
  }
  const data = await metaFetch<ImageResponse>(
    "/images/generations",
    { model: cfg.models.image, prompt, size: "1080x1920", n: 1 },
    cfg,
  );
  const first = data.data?.[0];
  if (first?.b64_json) return `data:image/png;base64,${first.b64_json}`;
  if (first?.url) return toDataUrl(first.url);
  return mockBackground(params.locale);
}

/** SVG gradient + motif per locale, encoded as a data URL. Renders on canvas without CORS issues. */
function mockBackground(locale: LocaleCode): string {
  const hexagons = Array.from({ length: 5 }, (_, r) =>
    Array.from({ length: 4 }, (_, c) => {
      const cx = 135 + c * 270;
      const cy = 240 + r * 360;
      return `<polygon points="${cx},${cy - 90} ${cx + 78},${cy - 45} ${cx + 78},${cy + 45} ${cx},${cy + 90} ${cx - 78},${cy + 45} ${cx - 78},${cy - 45}"/>`;
    }).join(""),
  ).join("");

  const waves = Array.from(
    { length: 6 },
    (_, i) =>
      `<path d="M0 ${200 + i * 300} Q 270 ${100 + i * 300} 540 ${200 + i * 300} T 1080 ${200 + i * 300}"/>`,
  ).join("");

  const sakura = [
    [120, 300, 70],
    [940, 420, 90],
    [200, 1500, 110],
    [880, 1650, 60],
    [540, 160, 40],
  ]
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`)
    .join("");

  const bars = Array.from({ length: 8 }, (_, i) => `<rect x="${i * 140}" y="1500" width="70" height="420"/>`).join("");

  const themes: Record<LocaleCode, { from: string; to: string; accent: string; motif: string }> = {
    "en-US": {
      from: "#0f172a",
      to: "#1d4ed8",
      accent: "#f43f5e",
      motif: `<g opacity="0.18" stroke="#ffffff" stroke-width="6" fill="none"><path d="M-100 1500 L1180 300"/><path d="M-100 1650 L1180 450"/><path d="M-100 1800 L1180 600"/></g><circle cx="900" cy="260" r="180" fill="#f43f5e" opacity="0.35"/>`,
    },
    "ja-JP": {
      from: "#fdf2f8",
      to: "#fb7185",
      accent: "#be123c",
      motif: `<g fill="#ffffff" opacity="0.45">${sakura}</g><circle cx="540" cy="1000" r="520" fill="#ffffff" opacity="0.12"/>`,
    },
    "id-ID": {
      from: "#042f2e",
      to: "#0d9488",
      accent: "#fbbf24",
      motif: `<g stroke="#fbbf24" stroke-width="3" fill="none" opacity="0.25">${waves}</g><circle cx="160" cy="1700" r="220" fill="#fbbf24" opacity="0.18"/>`,
    },
    "ar-SA": {
      from: "#1c1917",
      to: "#065f46",
      accent: "#d4af37",
      motif: `<g stroke="#d4af37" stroke-width="2" fill="none" opacity="0.3">${hexagons}</g>`,
    },
    "es-ES": {
      from: "#7c2d12",
      to: "#f59e0b",
      accent: "#fde68a",
      motif: `<circle cx="540" cy="-200" r="700" fill="#fde68a" opacity="0.18"/><g fill="#ffffff" opacity="0.12">${bars}</g>`,
    },
  };
  const t = themes[locale];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.from}"/><stop offset="1" stop-color="${t.to}"/></linearGradient><radialGradient id="glow" cx="0.5" cy="0.55" r="0.6"><stop offset="0" stop-color="${t.accent}" stop-opacity="0.35"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></radialGradient></defs><rect width="1080" height="1920" fill="url(#g)"/>${t.motif}<rect width="1080" height="1920" fill="url(#glow)"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/* -------------------------------------------------------------------------- */
/*  Orchestrator                                                               */
/* -------------------------------------------------------------------------- */

function deriveAppName(req: GenerateAsoRequest): string {
  if (req.appName?.trim()) return req.appName.trim().slice(0, 20);
  const words = req.description
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const guess = words.slice(0, 2).join(" ");
  return guess ? guess.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 20) : "YourApp";
}

/**
 * Runs the full multimodal pipeline:
 *   screenshots                -> SAM 3.1    (segments, per screenshot)
 *   screenshots + description  -> Muse Spark (per-locale metadata & poster copy)
 *   description + locale       -> Muse Image (per-locale background)
 * Each live call degrades to its mock counterpart on failure so the UI always gets a result.
 */
export async function generateAsoPackage(req: GenerateAsoRequest): Promise<GenerateAsoResponse> {
  const cfg = getMetaConfig();
  const warnings: string[] = [];
  const mockCfg: MetaConfig = { ...cfg, mock: true };
  const appName = deriveAppName(req);

  const withFallback = async <T>(label: string, live: () => Promise<T>, mock: () => Promise<T>) => {
    try {
      return await live();
    } catch (err) {
      warnings.push(`${label}: ${(err as Error).message} (used simulated output)`);
      return mock();
    }
  };

  // Segments picked interactively in the UI take precedence; otherwise run SAM 3.1 here.
  const segments = await Promise.all(
    req.screenshots.map((shot, i) => {
      const picked = req.segments?.[i];
      if (picked && picked.length) return Promise.resolve(picked);
      return withFallback(
        `SAM 3.1 (screenshot ${i + 1})`,
        () => segmentScreenshot(shot, i, cfg),
        () => segmentScreenshot(shot, i, mockCfg),
      );
    }),
  );

  const locales: LocaleResult[] = await Promise.all(
    req.locales.map(async (locale) => {
      const sparkParams = { appName, description: req.description, locale, screenshots: req.screenshots };
      const [spark, backgroundDataUrl] = await Promise.all([
        withFallback(
          `Muse Spark (${locale})`,
          () => generateLocaleMetadata(sparkParams, cfg),
          () => generateLocaleMetadata(sparkParams, mockCfg),
        ),
        withFallback(
          `Muse Image (${locale})`,
          () => generateBackground({ locale, description: req.description }, cfg),
          () => generateBackground({ locale, description: req.description }, mockCfg),
        ),
      ]);
      return {
        locale,
        metadata: spark.metadata,
        posters: spark.posters,
        culturalNote: spark.culturalNote,
        backgroundDataUrl,
      };
    }),
  );

  return {
    mode: cfg.mock ? "mock" : "live",
    segments,
    locales,
    warnings,
    generatedAt: new Date().toISOString(),
  };
}
