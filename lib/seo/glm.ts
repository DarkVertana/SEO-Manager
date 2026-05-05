// z.ai GLM client. Uses the OpenAI-compatible Chat Completions + Embeddings
// endpoints exposed at https://api.z.ai/api/paas/v4. The exported helpers
// (generateJson, generateText, generateJsonMultimodal, embedTexts) keep the
// same shape as the prior @google/genai integration so callers do not need
// to change.

import { AsyncLocalStorage } from "node:async_hooks";

// Per-call context lets a caller (e.g. the audit trackStep) run an agent
// inside withStepContext({ onStart }) and be notified when this client has
// actually acquired the GLM semaphore and is about to issue its first
// request — i.e. the moment an agent is genuinely "running" rather than
// just queued behind another in-flight call. Without this, the UI would
// flip every parallel agent to "running…" instantly even when only one was
// actually executing.
const stepCtx = new AsyncLocalStorage<{ onStart?: () => void }>();
export function withStepContext<T>(
  onStart: (() => void) | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  return stepCtx.run({ onStart }, fn);
}

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
// chat calls to GLM_CONCURRENCY (default 5) and retry on 429 with backoff.
// 5 in-flight finishes the 7-agent audit in ~2 batches; if 429 retries
// dominate, drop to 3 via env.
const CONCURRENCY = Math.max(1, Number(process.env.GLM_CONCURRENCY ?? 5));
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
// function budget. The programmatic-SEO and schema-suggestions schemas
// routinely emit ~3-4k tokens; cutting them off produces unterminated
// strings that parseJsonLoose can only partially recover from. Default
// high enough to cover every schema we use with comfortable headroom.
// Calls that need less finish well before the cap, so this is purely
// an upper bound.
const DEFAULT_MAX_TOKENS = Math.max(256, Number(process.env.GLM_MAX_TOKENS ?? 8000));

async function chat(args: {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: ResponseFormat;
}): Promise<string> {
  await acquire();
  try {
    // Notify the caller that this step is now genuinely in flight (semaphore
    // acquired, request about to leave). Fire only on the first attempt so
    // retries don't re-emit "running".
    const ctx = stepCtx.getStore();
    if (ctx?.onStart) {
      ctx.onStart();
      ctx.onStart = undefined;
    }
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
          choices?: { message?: { content?: string }; finish_reason?: string }[];
        };
        const choice = json.choices?.[0];
        const text = choice?.message?.content;
        if (!text) throw new Error("GLM returned an empty response");
        // finish_reason "length" means we hit max_tokens mid-output. The
        // body is valid prefix-wise but almost certainly malformed JSON.
        // Surface a clear error so the caller knows to raise GLM_MAX_TOKENS
        // rather than chasing a confusing JSON parse failure downstream.
        if (choice?.finish_reason === "length") {
          throw new Error(
            `GLM response truncated at max_tokens (${args.max_tokens ?? DEFAULT_MAX_TOKENS}). Raise GLM_MAX_TOKENS or shorten the schema.`,
          );
        }
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
    const slice = end > start ? text.slice(start, end + 1) : text.slice(start);
    try {
      return JSON.parse(slice) as T;
    } catch {
      // Best-effort recovery for truncated output: close the dangling string
      // (if any), drop a trailing partial value/key, and balance brackets.
      const repaired = repairJson(slice, open === "{" ? "object" : "array");
      try {
        return JSON.parse(repaired) as T;
      } catch {
        throw new Error(`GLM returned non-JSON output: ${raw.slice(0, 200)}…`);
      }
    }
  }
}

// Walk the body tracking string/escape state and the bracket stack, then
// emit the closers needed to form a parseable shape. Truncated arrays of
// objects (most common failure for our schemas) typically just need the
// final object closed off and a few "]"/"}" appended.
function repairJson(input: string, top: "object" | "array"): string {
  let inString = false;
  let escape = false;
  const stack: string[] = [];
  let lastSafe = 0;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (escape) { escape = false; continue; }
    if (c === "\\") { escape = true; continue; }
    if (inString) {
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; continue; }
    if (c === "{" || c === "[") stack.push(c);
    else if (c === "}" || c === "]") stack.pop();
    if (!inString && (c === "," || c === "}" || c === "]") && stack.length > 0) {
      lastSafe = i;
    }
  }
  // Trim back to the last safe boundary, then close everything still open.
  let trimmed = input.slice(0, lastSafe + 1).replace(/,\s*$/, "");
  // Re-walk the trimmed slice to recompute the open stack.
  inString = false;
  escape = false;
  const open: string[] = [];
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (escape) { escape = false; continue; }
    if (c === "\\") { escape = true; continue; }
    if (inString) { if (c === '"') inString = false; continue; }
    if (c === '"') { inString = true; continue; }
    if (c === "{" || c === "[") open.push(c);
    else if (c === "}" || c === "]") open.pop();
  }
  while (open.length) trimmed += open.pop() === "{" ? "}" : "]";
  if (!trimmed) return top === "object" ? "{}" : "[]";
  return trimmed;
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
    // Default to deterministic sampling (temperature 0) so SEO scores are
    // stable across re-runs of the same URL. Sampling variance at 0.3 was
    // producing visibly different scores per agent for identical inputs,
    // which makes the audit feel untrustworthy. Callers can still override.
    temperature: args.temperature ?? 0,
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
    temperature: args.temperature ?? 0,
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
