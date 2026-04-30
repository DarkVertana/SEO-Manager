import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/server";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const audits = await db.seoAnalysis.findMany({
    where: { userId: session.uid },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      url: true,
      command: true,
      industry: true,
      overallScore: true,
      createdAt: true,
    },
    take: 100,
  });
  return Response.json({ audits });
}
