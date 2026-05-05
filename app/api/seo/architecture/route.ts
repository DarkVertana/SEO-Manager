import { NextRequest } from "next/server";
import { runArchitecture, type AuditEvent } from "@/lib/seo/audit";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/server";
import { checkAuditQuota } from "@/lib/auth/quota";

export const runtime = "nodejs";
export const maxDuration = 300;

// NDJSON stream — see app/api/seo/audit/route.ts for the protocol.
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

  const encoder = new TextEncoder();
  type FinalEvent = { type: "complete"; id: string } | { type: "error"; error: string };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AuditEvent | FinalEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      try {
        const report = await runArchitecture(target.toString(), send);
        const saved = await db.seoAnalysis.create({
          data: {
            userId: session.uid,
            url: target.toString(),
            command: "architecture",
            industry: report.industry.industry,
            overallScore: report.overallScore,
            scores: {},
            parsed: {},
            report: report as unknown as object,
          },
        });
        send({ type: "complete", id: saved.id });
      } catch (err) {
        send({ type: "error", error: err instanceof Error ? err.message : "Architecture analysis failed" });
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
