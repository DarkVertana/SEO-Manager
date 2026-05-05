// z.ai GLM client. Uses the OpenAI-compatible Chat Completions + Embeddings
// endpoints exposed at https://api.z.ai/api/paas/v4. The exported helpers
// (generateJson, generateText, generateJsonMultimodal, embedTexts) keep the
// same shape as the prior @google/genai integration so callers do not need
// to change.

// Defaults to the GLM Coding Plan endpoint, which is billed against an active
// coding subscription rather than the pay-per-token PaaS balance. Override
// with ZAI_BASE_URL=https://api.z.ai/api/paas/v4 to use the pay-as-you-go API.
const BASE_URL = process.env.ZAI_BASE_URL ?? "https://api.z.ai/api/coding/paas/v4";

export const GLM_MODEL = "glm-5.1";
export const GLM_EMBED_MODEL = "embedding-3";
// glm-5.1 is text-only. Vision-only callers (e.g. the section rewriter) should
// pass `model` explicitly or set ZAI_VISION_MODEL to a vision-capable variant
// like glm-4.5v before re-enabling /seo rewrite.
const VISION_MODEL = process.env.ZAI_VISION_MODEL ?? "glm-4.5v";

export type JsonSchema = Record<string, unknown>;

export type ChatMessageContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | ChatMessageContentPart[];
};

type ResponseFormat =
  | { type: "json_object" }
  | {
      type: "json_schema";
      json_schema: { name: string; schema: JsonSchema; strict?: boolean };
    };

function getKey(): string {
  const key = process.env.ZAI_API_KEY;
  if (!key) throw new Error("ZAI_API_KEY is not set");
  return key;
}

// The audit pipeline fans out 7 agents in parallel (see lib/seo/audit.ts);
// architecture/programmatic add more. Without throttling, z.ai returns
// 429 "Rate limit reached for requests" (code 1302). Limit live in-flight
// chat calls to GLM_CONCURRENCY (default 2) and retry on 429 with backoff.
const CONCURRENCY = Math.max(1, Number(process.env.GLM_CONCURRENCY ?? 1));
const MAX_RETRIES = Math.max(0, Number(process.env.GLM_MAX_RETRIES ?? 5));

let inFlight = 0;
const waiters: (() => void)[] = [];

async function acquire(): Promise<void> {
  if (inFlight < CONCURRENCY) {
    inFlight++;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
  inFlight++;
}

function release(): void {
  inFlight--;
  const next = waiters.shift();
  if (next) next();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// glm-5.1 is a reasoning model: by default it spends most of its latency
// emitting hidden thinking tokens before any content. Our SEO prompts are
// straightforward JSON extraction (classify findings, fill a known schema),
// so the reasoning is wasted time — we measured single agents taking 95s and
// 221s with thinking on, blowing past the 300s Vercel hobby cap. Disable it
// unless GLM_THINKING=enabled is set explicitly.
const THINKING_ENABLED = process.env.GLM_THINKING === "enabled";
// Hard cap on completion tokens so a single call cannot eat the entire
// function budget. Schemas top out around ~2.5k tokens of output.
const DEFAULT_MAX_TOKENS = Math.max(256, Number(process.env.GLM_MAX_TOKENS ?? 4000));

async function chat(args: {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: ResponseFormat;
}): Promise<string> {
  await acquire();
  try {
    let attempt = 0;
    while (true) {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getKey()}`,
        },
        body: JSON.stringify({
          model: args.model ?? GLM_MODEL,
          messages: args.messages,
          temperature: args.temperature,
          max_tokens: args.max_tokens ?? DEFAULT_MAX_TOKENS,
          response_format: args.response_format,
          thinking: { type: THINKING_ENABLED ? "enabled" : "disabled" },
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const text = json.choices?.[0]?.message?.content;
        if (!text) throw new Error("GLM returned an empty response");
        return text;
      }
      const body = await res.text().catch(() => "");
      // Retry on 429 (rate limit) and 5xx with exponential backoff.
      const retryable = res.status === 429 || (res.status >= 500 && res.status < 600);
      if (retryable && attempt < MAX_RETRIES) {
        const retryAfterHeader = Number(res.headers.get("retry-after"));
        const headerDelay = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
          ? retryAfterHeader * 1000
          : 0;
        const backoff = Math.min(15000, 800 * Math.pow(2, attempt)) + Math.random() * 250;
        await sleep(Math.max(headerDelay, backoff));
        attempt++;
        continue;
      }
      throw new Error(`GLM chat failed: ${res.status} ${body}`);
    }
  } finally {
    release();
  }
}

// glm-5.1 ignores response_format.json_schema and frequently wraps output in
// ```json fences or adds prose. Build a system prompt that inlines the schema
// and demands raw JSON, then sanitize the response before parsing.
function buildJsonSystem(systemInstruction: string, schema: JsonSchema): string {
  return `${systemInstruction}

OUTPUT FORMAT (strict):
- Return ONLY a single JSON value that conforms to the schema below.
- Do NOT wrap the response in markdown code fences (no \`\`\`json).
- Do NOT include any prose, headings, comments, or explanation before or after the JSON.
- Use the exact property names from the schema. Do not invent extra fields.

JSON SCHEMA:
${JSON.stringify(schema)}`;
}

function parseJsonLoose<T>(raw: string): T {
  let text = raw.trim();
  // Strip ```json … ``` or ``` … ``` fences if the model added them.
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) text = fence[1].trim();
  // Some models prefix prose ("Here is the JSON: { … }"). Fall back to the
  // first balanced { … } or [ … ] in the response.
  try {
    return JSON.parse(text) as T;
  } catch {
    const objStart = text.indexOf("{");
    const arrStart = text.indexOf("[");
    const start = objStart === -1
      ? arrStart
      : arrStart === -1
        ? objStart
        : Math.min(objStart, arrStart);
    if (start < 0) throw new Error(`GLM returned non-JSON output: ${raw.slice(0, 200)}`);
    const open = text[start];
    const close = open === "{" ? "}" : "]";
    const end = text.lastIndexOf(close);
    if (end <= start) throw new Error(`GLM returned non-JSON output: ${raw.slice(0, 200)}`);
    return JSON.parse(text.slice(start, end + 1)) as T;
  }
}

export async function generateJson<T>(args: {
  systemInstruction: string;
  prompt: string;
  schema: JsonSchema;
  temperature?: number;
}): Promise<T> {
  const text = await chat({
    messages: [
      { role: "system", content: buildJsonSystem(args.systemInstruction, args.schema) },
      { role: "user", content: args.prompt },
    ],
    temperature: args.temperature ?? 0.3,
    response_format: { type: "json_object" },
  });
  return parseJsonLoose<T>(text);
}

export async function generateText(args: {
  systemInstruction?: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<string> {
  const messages: ChatMessage[] = [];
  if (args.systemInstruction) {
    messages.push({ role: "system", content: args.systemInstruction });
  }
  messages.push({ role: "user", content: args.prompt });
  return chat({
    messages,
    temperature: args.temperature ?? 0.7,
    max_tokens: args.maxOutputTokens,
  });
}

export async function generateJsonMultimodal<T>(args: {
  systemInstruction: string;
  parts: ChatMessageContentPart[];
  schema: JsonSchema;
  temperature?: number;
}): Promise<T> {
  const text = await chat({
    messages: [
      { role: "system", content: buildJsonSystem(args.systemInstruction, args.schema) },
      { role: "user", content: args.parts },
    ],
    model: VISION_MODEL,
    temperature: args.temperature ?? 0.4,
    response_format: { type: "json_object" },
  });
  return parseJsonLoose<T>(text);
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const out: number[][] = [];
  const BATCH = 64;
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const res = await fetch(`${BASE_URL}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getKey()}`,
      },
      body: JSON.stringify({ model: GLM_EMBED_MODEL, input: batch }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`GLM embeddings failed: ${res.status} ${body}`);
    }
    const json = (await res.json()) as { data?: { embedding: number[] }[] };
    const data = json.data ?? [];
    if (data.length !== batch.length) {
      throw new Error(`Embedding count mismatch: expected ${batch.length}, got ${data.length}`);
    }
    for (const d of data) {
      if (!d.embedding || d.embedding.length === 0) throw new Error("Empty embedding vector");
      out.push(d.embedding);
    }
  }
  return out;
}
