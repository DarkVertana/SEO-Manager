import { NextRequest } from "next/server";
import { runPage } from "@/lib/seo/audit";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/server";
import { checkAuditQuota } from "@/lib/auth/quota";

export const runtime = "nodejs";
export const maxDuration = 60;

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

  try {
    const report = await runPage(target.toString());
    const saved = await db.seoAnalysis.create({
      data: {
        userId: session.uid,
        url: target.toString(),
        command: "page",
        industry: report.industry.industry,
        overallScore: report.overallScore,
        scores: report.scores,
        parsed: {},
        report: report as unknown as object,
      },
    });
    return Response.json({ id: saved.id, report });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
