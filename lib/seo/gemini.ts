import { GoogleGenAI, type Schema } from "@google/genai";

let cached: GoogleGenAI | null = null;

export function getGemini(): GoogleGenAI {
  if (cached) return cached;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  cached = new GoogleGenAI({ apiKey });
  return cached;
}

export const GEMINI_MODEL = "gemini-3.1-pro-preview";
// Embedding model for the brightdata-style research pipeline. The 768-d
// gemini-embedding-001 replaces OpenAI text-embedding-3-small in the upstream
// reference. Increase outputDimensionality if you need richer vectors.
export const GEMINI_EMBED_MODEL = "gemini-embedding-001";

export async function generateJson<T>(args: {
  systemInstruction: string;
  prompt: string;
  schema: Schema;
  temperature?: number;
}): Promise<T> {
  const ai = getGemini();
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text: args.prompt }] }],
    config: {
      systemInstruction: args.systemInstruction,
      responseMimeType: "application/json",
      responseSchema: args.schema,
      temperature: args.temperature ?? 0.3,
    },
  });
  const text = response.text;
  if (!text) throw new Error("Gemini returned an empty response");
  return JSON.parse(text) as T;
}

// Plain text/markdown generation — used by the brightdata-style article
// generator pipeline (no JSON schema enforcement; model writes prose).
export async function generateText(args: {
  systemInstruction?: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<string> {
  const ai = getGemini();
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text: args.prompt }] }],
    config: {
      systemInstruction: args.systemInstruction,
      temperature: args.temperature ?? 0.7,
      maxOutputTokens: args.maxOutputTokens,
    },
  });
  const text = response.text;
  if (!text) throw new Error("Gemini returned an empty response");
  return text;
}

// Batched embedding helper. The Gemini API accepts a list of strings per call,
// but we split into chunks of 100 to stay safely under per-request limits.
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const ai = getGemini();
  const out: number[][] = [];
  const BATCH = 100;
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const response = await ai.models.embedContent({
      model: GEMINI_EMBED_MODEL,
      contents: batch,
    });
    const embeddings = response.embeddings ?? [];
    if (embeddings.length !== batch.length) {
      throw new Error(`Embedding count mismatch: expected ${batch.length}, got ${embeddings.length}`);
    }
    for (const e of embeddings) {
      const values = e.values;
      if (!values || values.length === 0) throw new Error("Empty embedding vector");
      out.push(values);
    }
  }
  return out;
}
