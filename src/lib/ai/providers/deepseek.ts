/**
 * DeepSeek (OpenAI-compatible chat completions).
 *
 * Text + vision: `deepseek-flash` accepts images as `image_url` blocks (base64 data URLs or
 * public links). `deepseek-v4-pro` is text-only, so screenshots are described in words instead.
 * DeepSeek has no hosted image generation or box/mask segmentation, so pair it with another
 * provider via AI_IMAGE_PROVIDER / AI_SEGMENT_PROVIDER (or leave those on mock).
 * Docs: https://api-docs.deepseek.com/guides/vision
 */
import { extractJson, postJson, ProviderError, type ChatJsonParams, type TextProvider } from "../types";

/** Models documented as accepting image input. Override with DEEPSEEK_VISION=true|false. */
const VISION_MODELS = ["deepseek-flash", "deepseek-v4-flash-vision-exp"];

function cfg() {
  const model = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-flash";
  const flag = process.env.DEEPSEEK_VISION?.trim().toLowerCase();
  return {
    apiKey: process.env.DEEPSEEK_API_KEY?.trim() || "",
    baseUrl: (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, ""),
    model,
    vision: flag === "true" ? true : flag === "false" ? false : VISION_MODELS.includes(model),
  };
}

export function deepseekConfigured(): boolean {
  return cfg().apiKey.length > 0;
}

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
}

export class DeepSeekTextProvider implements TextProvider {
  readonly name = "deepseek" as const;
  get model() {
    return cfg().model;
  }
  get supportsVision() {
    return cfg().vision;
  }

  async chatJson<T>({ system, user, images = [], temperature = 0.7 }: ChatJsonParams): Promise<T> {
    const c = cfg();
    const sendImages = c.vision && images.length > 0;

    // Images are only accepted in user messages, as image_url blocks after the text.
    const userContent: unknown = sendImages
      ? [{ type: "text", text: user }, ...images.map((url) => ({ type: "image_url", image_url: { url, detail: "auto" } }))]
      : images.length
        ? `${user}\n\n(${images.length} screenshot(s) exist but this model cannot see images; rely on the text above.)`
        : user;

    const body = {
      model: c.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      temperature,
    };
    const headers = { Authorization: `Bearer ${c.apiKey}` };
    const url = `${c.baseUrl}/chat/completions`;

    let data: ChatResponse;
    try {
      data = await postJson<ChatResponse>(url, body, headers, "deepseek");
    } catch (err) {
      // The docs do not confirm json_object together with images; if the API rejects the
      // combination, retry without it. The system prompt still demands JSON, and extractJson
      // pulls the object out of any surrounding prose.
      const rejected = err instanceof ProviderError && / 400 /.test(err.message);
      if (!sendImages || !rejected) throw err;
      const { response_format: _drop, ...withoutFormat } = body;
      void _drop;
      data = await postJson<ChatResponse>(url, withoutFormat, headers, "deepseek");
    }
    return extractJson<T>(data.choices?.[0]?.message?.content ?? "");
  }
}
