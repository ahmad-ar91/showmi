import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { StoreListing } from "../play-store";

/**
 * Fictional apps for the one-click demo. Names were checked against Google Play search and
 * did not match any listed app; all copy is original and the screenshots were generated for
 * this project. Never replace these with real products.
 */
export const SAMPLE_APP_ID = "com.example.ritmova";
export const SAMPLE_COMPETITOR_ID = "com.example.paceto";

function letterIcon(letter: string, bg: string, fg = "#ffffff"): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="${bg}"/><text x="64" y="86" text-anchor="middle" font-family="Georgia, serif" font-size="68" fill="${fg}">${letter}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

type SampleListing = Omit<StoreListing, "screenshots" | "source"> & { screenshotFiles: string[] };

const SAMPLES: Record<string, SampleListing> = {
  [SAMPLE_APP_ID]: {
    appId: SAMPLE_APP_ID,
    title: "Ritmova: Habits and Workouts",
    summary: "Track your habits and workouts in one place, every day, with reminders and stats.",
    description: [
      "Ritmova helps you keep track of your habits and your workouts.",
      "",
      "Add the habits you want to build, set a time, and Ritmova reminds you. Log workouts and see your weekly progress in a simple chart.",
      "",
      "Features",
      "- Habit list with daily reminders",
      "- Workout log with minutes and type",
      "- Weekly stats and streaks",
      "- Light theme",
      "",
      "Ritmova is made by a small team that cares about routines. We read every review and update the app often.",
    ].join("\n"),
    score: 4.4,
    ratings: 18240,
    installs: "500,000+",
    icon: letterIcon("R", "#5b3df5"),
    developer: "Ritmova Labs (sample)",
    genre: "Health & Fitness",
    url: "https://example.com/ritmova",
    screenshotFiles: ["ritmova-home.jpg", "ritmova-stats.jpg"],
  },
  [SAMPLE_COMPETITOR_ID]: {
    appId: SAMPLE_COMPETITOR_ID,
    title: "Paceto: Running Coach & Plans",
    summary: "Free running coach: personalized training plans, guided runs and daily streaks.",
    description: [
      "Start running today with Paceto, the free running coach that builds a personalized training plan around your schedule.",
      "",
      "Beginner? Follow guided runs with audio coaching from your first 5K to your first half marathon. Already running? Set a goal pace and Paceto adapts your plan every week.",
      "",
      "Why runners choose Paceto",
      "- Personalized training plans for beginner to advanced runners",
      "- Guided runs with audio coaching",
      "- Daily streaks and weekly goals that keep you motivated",
      "- Works offline, syncs when you are back online",
      "- Home workouts and stretching for rest days",
      "",
      "Join a community of runners, share your progress and celebrate every streak. Download Paceto free and start your first guided run today.",
    ].join("\n"),
    score: 4.7,
    ratings: 96310,
    installs: "1,000,000+",
    icon: letterIcon("P", "#e8532c"),
    developer: "Paceto Studio (sample)",
    genre: "Health & Fitness",
    url: "https://example.com/paceto",
    screenshotFiles: [],
  },
};

export function isSampleApp(appId: string): boolean {
  return appId in SAMPLES;
}

/** Loads a sample listing with its screenshots inlined from public/samples as data URLs. */
export async function sampleListing(appId: string): Promise<StoreListing> {
  const s = SAMPLES[appId];
  if (!s) throw new Error(`Unknown sample app "${appId}".`);
  const dir = path.join(process.cwd(), "public", "samples");
  const screenshots = await Promise.all(
    s.screenshotFiles.map(async (f) => `data:image/jpeg;base64,${(await readFile(path.join(dir, f))).toString("base64")}`),
  );
  const { screenshotFiles: _files, ...rest } = s;
  void _files;
  return { ...rest, screenshots, source: "sample" };
}
