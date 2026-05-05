import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/server";
import { generateSeoContent } from "@/lib/seo/generator/pipeline";
import type { GenerateOutputType } from "@/lib/seo/generator/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { keyword?: string; urls?: string[] | string; outputType?: string; targetWordCount?: number };
  try { body = await request.json(); } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const keyword = (body.keyword ?? "").trim();
  if (!keyword) return Response.json({ error: "Missing 'keyword'" }, { status: 400 });

  const rawUrls = Array.isArray(body.urls)
    ? body.urls
    : typeof body.urls === "string"
      ? body.urls.split(/[\n,]+/)
      : [];
  const urls = rawUrls
    .map((u) => u.trim())
    .filter(Boolean)
    .filter((u) => {
      try {
        const parsed = new URL(u);
        return ["http:", "https:"].includes(parsed.protocol);
      } catch {
        return false;
      }
    });
  if (urls.length === 0) {
    return Response.json({ error: "Provide at least one valid http(s) URL." }, { status: 400 });
  }
  if (urls.length > 20) {
    return Response.json({ error: "Maximum 20 source URLs per request." }, { status: 400 });
  }

  const outputType: GenerateOutputType = body.outputType === "article" ? "article" : "outline";
  const targetWordCount = clamp(body.targetWordCount ?? 1500, 400, 5000);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        for await (const event of generateSeoContent({ keyword, urls, outputType, targetWordCount })) {
          send(event);
        }
      } catch (err) {
        send({ type: "error", error: err instanceof Error ? err.message : "Pipeline failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}
