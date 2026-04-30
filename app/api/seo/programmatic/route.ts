import { NextRequest } from "next/server";
import { runProgrammaticSeo } from "@/lib/seo/audit";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/server";
import { PROGRAMMATIC_PLAYBOOKS, type ProgrammaticPlaybook } from "@/lib/seo/references";
import { checkAuditQuota } from "@/lib/auth/quota";

const VALID_PLAYBOOKS = new Set(PROGRAMMATIC_PLAYBOOKS.map((p) => p.name));

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const quota = await checkAuditQuota(session.uid);
  if (!quota.ok) return Response.json({ error: quota.reason }, { status: quota.status });

  let body: { url?: string; playbook?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const url = body.url?.trim();
  if (!url) return Response.json({ error: "Missing 'url'" }, { status: 400 });

  let target: URL;
  try { target = new URL(url); } catch { return Response.json({ error: "Invalid URL" }, { status: 400 }); }
  if (!["http:", "https:"].includes(target.protocol)) {
    return Response.json({ error: "URL must be http(s)" }, { status: 400 });
  }

  const preferredPlaybook = body.playbook && VALID_PLAYBOOKS.has(body.playbook as ProgrammaticPlaybook)
    ? (body.playbook as ProgrammaticPlaybook)
    : undefined;

  try {
    const report = await runProgrammaticSeo(target.toString(), preferredPlaybook);
    const saved = await db.seoAnalysis.create({
      data: {
        userId: session.uid,
        url: target.toString(),
        command: "programmatic",
        industry: report.industry.industry,
        overallScore: 100 - report.thinContentRiskScore,
        scores: {},
        parsed: {},
        report: report as unknown as object,
      },
    });
    return Response.json({ id: saved.id, report });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Programmatic SEO analysis failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
