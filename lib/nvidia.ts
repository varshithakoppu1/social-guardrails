// lib/nvidia.ts
//
// Thin client around the NVIDIA Nemotron 3.5 Content Safety API.
// Keeps the messy request shape and string-parsing in one place so
// the API route stays clean.

export interface SafetyVerdict {
  safe: boolean;
  categories: string[];
  raw: string;
}

export class NvidiaApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(`NVIDIA API error (${status})`);
    this.status = status;
    this.detail = detail;
  }
}

const NVIDIA_ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";
const MODEL_ID = "nvidia/nemotron-3.5-content-safety";

export async function checkContentSafety(
  caption: string,
  imageBase64?: string
): Promise<SafetyVerdict> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY is not configured on the server");
  }

  const content: Array<Record<string, unknown>> = [{ type: "text", text: caption }];
  if (imageBase64) {
    content.push({ type: "image_url", image_url: { url: imageBase64 } });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  let response: Response;
  try {
    response = await fetch(NVIDIA_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_ID,
        messages: [{ role: "user", content }],
        max_tokens: 150,
        temperature: 0.01,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new NvidiaApiError(504, "NVIDIA API request timed out");
    }
    throw new NvidiaApiError(502, `Failed to reach NVIDIA API: ${(err as Error).message}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new NvidiaApiError(response.status, detail);
  }

  const data = await response.json();
  const raw: string = data?.choices?.[0]?.message?.content ?? "";

  const safe = raw.includes("User Safety: safe");
  const categoriesMatch = raw.match(/Safety Categories: (.*)/);
  const categories = categoriesMatch
    ? categoriesMatch[1]
        .split(",")
        .map((c: string) => c.trim())
        .filter(Boolean)
    : [];

  return { safe, categories, raw };
}
