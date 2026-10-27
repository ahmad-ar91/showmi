/**
 * Simulated providers: realistic, deterministic output used when no vendor key is configured
 * (or MOCK_MODE=true) so the whole UI, canvas and export pipeline can be demoed offline.
 */
import { PLAY_LIMITS, type LocaleCode, type PlayStoreMetadata, type PosterCopy, type Segment } from "../../types";
import { truncateChars } from "../../utils";
import type {
  DetectedBox,
  GenerateImageParams,
  ImageProvider,
  SegmentParams,
  SegmentProvider,
  TextProvider,
} from "../types";

export interface SparkOutput {
  metadata: PlayStoreMetadata;
  posters: PosterCopy[];
  culturalNote: string;
}

export function enforceLimits(out: SparkOutput, screenshotCount: number): SparkOutput {
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

/**
 * Realistic fallback: four candidate UI regions per screenshot in typical mobile UI zones.
 * The user picks which of them become floating badges in the Segment Picker.
 */
export function mockSegments(index: number): Segment[] {
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

export function mockSpark(params: {
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

/** SVG gradient + motif per locale, encoded as a data URL. Renders on canvas without CORS issues. */
export function mockBackground(locale: LocaleCode): string {
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

/* ------------------------------- Provider wrappers ------------------------------- */

export class MockTextProvider implements TextProvider {
  readonly name = "mock" as const;
  readonly model = "simulated";
  readonly supportsVision = true;
  /** The orchestrator never calls this for mock: it uses the typed mock functions above. */
  async chatJson<T>(): Promise<T> {
    throw new Error("Mock text provider has no generic chat; use mockSpark()/mockAnalysis().");
  }
}

export class MockImageProvider implements ImageProvider {
  readonly name = "mock" as const;
  readonly model = "simulated-svg";
  async generateImage({ hint }: GenerateImageParams): Promise<string> {
    return mockBackground((hint as LocaleCode) || "en-US");
  }
}

export class MockSegmentProvider implements SegmentProvider {
  readonly name = "mock" as const;
  readonly model = "simulated-regions";
  async segment({ hint }: SegmentParams): Promise<DetectedBox[]> {
    return mockSegments(typeof hint === "number" ? hint : 0).map(({ label, score, bbox }) => ({ label, score, bbox }));
  }
}
