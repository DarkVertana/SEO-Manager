import { NextRequest } from "next/server";
import { runPage, type AuditEvent } from "@/lib/seo/audit";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/server";
import { checkAuditQuota } from "@/lib/auth/quota";

export const runtime = "nodejs";
export const maxDuration = 60;

// See app/api/seo/audit/route.ts for the streaming protocol.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const quota = await checkAuditQuota(session.uid);
  if (!quota.ok) return Response.json({ error: quota.reason }, { status: quota.status });

  let body: { url?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const url = body.url?.trim();
  if (!url) return Response.json({ error: "Missing 'url'" }, { status: 400 });

  let target: URL;
  try { target = new URL(url); } catch { return Response.json({ error: "Invalid URL" }, { status: 400 }); }
  if (!["http:", "https:"].includes(target.protocol)) {
    return Response.json({ error: "URL must be http(s)" }, { status: 400 });
  }

  const record = await db.seoAnalysis.create({
    data: {
      userId: session.uid,
      url: target.toString(),
      command: "page",
      industry: null,
      overallScore: 0,
      scores: {},
      parsed: {},
      report: { status: "in_progress" },
    },
  });

  const encoder = new TextEncoder();
  type FinalEvent =
    | { type: "init"; id: string }
    | { type: "complete"; id: string }
    | { type: "error"; error: string; id: string };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AuditEvent | FinalEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      send({ type: "init", id: record.id });
      try {
        const report = await runPage(target.toString(), send);
        await db.seoAnalysis.update({
          where: { id: record.id },
          data: {
            industry: report.industry.industry,
            overallScore: report.overallScore,
            scores: report.scores,
            report: report as unknown as object,
          },
        });
        send({ type: "complete", id: record.id });
      } catch (err) {
        send({ type: "error", error: err instanceof Error ? err.message : "Analysis failed", id: record.id });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
