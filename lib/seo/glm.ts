// z.ai GLM client. Uses the OpenAI-compatible Chat Completions + Embeddings
// endpoints exposed at https://api.z.ai/api/paas/v4. The exported helpers
// (generateJson, generateText, generateJsonMultimodal, embedTexts) keep the
// same shape as the prior @google/genai integration so callers do not need
// to change.

const BASE_URL = process.env.ZAI_BASE_URL ?? "https://api.z.ai/api/paas/v4";

export const GLM_MODEL = "glm-5.1";
export const GLM_EMBED_MODEL = "embedding-3";

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

async function chat(args: {
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: ResponseFormat;
}): Promise<string> {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getKey()}`,
    },
    body: JSON.stringify({
      model: GLM_MODEL,
      messages: args.messages,
      temperature: args.temperature,
      max_tokens: args.max_tokens,
      response_format: args.response_format,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GLM chat failed: ${res.status} ${body}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error("GLM returned an empty response");
  return text;
}

export async function generateJson<T>(args: {
  systemInstruction: string;
  prompt: string;
  schema: JsonSchema;
  temperature?: number;
}): Promise<T> {
  const text = await chat({
    messages: [
      { role: "system", content: args.systemInstruction },
      { role: "user", content: args.prompt },
    ],
    temperature: args.temperature ?? 0.3,
    response_format: {
      type: "json_schema",
      json_schema: { name: "response", schema: args.schema, strict: false },
    },
  });
  return JSON.parse(text) as T;
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
      { role: "system", content: args.systemInstruction },
      { role: "user", content: args.parts },
    ],
    temperature: args.temperature ?? 0.4,
    response_format: {
      type: "json_schema",
      json_schema: { name: "response", schema: args.schema, strict: false },
    },
  });
  return JSON.parse(text) as T;
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
