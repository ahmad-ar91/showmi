/**
 * Browser-side API calls. Turns the failures people actually hit on a hosted deploy
 * (timeouts, rate limits, oversized requests, HTML error pages) into plain sentences.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function explain(status: number, serverMessage: string | undefined): string {
  if (serverMessage && status < 500 && status !== 413 && status !== 429) return serverMessage;
  switch (status) {
    case 0:
      return "Could not reach the server. Check your connection and try again.";
    case 408:
    case 504:
      return "The request took longer than the server allows. Try fewer markets at once, or try again.";
    case 413:
      return "The screenshots are too large to send. Use smaller images or fewer screenshots.";
    case 429:
      return "The model provider is busy right now. Wait a few seconds and try again.";
    default:
      return serverMessage ? `${serverMessage}` : `The server returned an error (${status}). Try again.`;
  }
}

/** POSTs JSON and returns the parsed body, or throws an ApiError with a readable message. */
export async function postJson<T>(url: string, body: unknown, init?: { signal?: AbortSignal }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: init?.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(explain(0, undefined), 0);
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Platform error pages (timeouts, payload limits) are HTML or plain text, not JSON.
  }
  const serverMessage =
    data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
      ? (data as { error: string }).error
      : undefined;

  if (!res.ok || serverMessage) throw new ApiError(explain(res.status, serverMessage), res.status);
  if (data === null) throw new ApiError("The server sent an empty response. Try again.", res.status);
  return data as T;
}

/** Runs fn over items with at most `limit` in flight, reporting progress. Keeps input order. */
export async function inBatches<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  let done = 0;
  onProgress?.(0, items.length);
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
      done += 1;
      onProgress?.(done, items.length);
    }
  });
  await Promise.all(workers);
  return out;
}
