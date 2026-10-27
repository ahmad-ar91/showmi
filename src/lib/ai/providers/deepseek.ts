/**
 * DeepSeek (OpenAI-compatible chat API). Text-only: DeepSeek has no hosted image
 * generation or segmentation, so pair it with another image/segment provider via
 * AI_IMAGE_PROVIDER / AI_SEGMENT_PROVIDER (or leave those on mock).
 * Docs: https://api-docs.deepseek.com
 */
import { extractJson, postJson, type ChatJsonParams, type TextProvider } from "../types";

function cfg() {
  return {
    apiKey: process.env.DEEPSEEK_API_KEY?.trim() || "",
    baseUrl: (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1").replace(/\/$/, ""),
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
  };
}

export function deepseekConfigured(): boolean {
  return cfg().apiKey.length > 0;
}

export class DeepSeekTextProvider implements TextProvider {
  readonly name = "deepseek" as const;
  readonly supportsVision = false;
  get model() {
    return cfg().model;
  }

  async chatJson<T>({ system, user, images = [], temperature = 0.7 }: ChatJsonParams): Promise<T> {
    const c = cfg();
    const note = images.length
      ? `\n\n(Note: ${images.length} screenshot(s) were attached but this model cannot see images; rely on the textual description.)`
      : "";
    interface ChatResponse {
      choices?: { message?: { content?: string } }[];
    }
    const data = await postJson<ChatResponse>(
      `${c.baseUrl}/chat/completions`,
      {
        model: c.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user + note },
        ],
        response_format: { type: "json_object" },
        temperature,
      },
      { Authorization: `Bearer ${c.apiKey}` },
      "deepseek",
    );
    return extractJson<T>(data.choices?.[0]?.message?.content ?? "");
  }
}
