import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/server";
import { readPageHtml } from "@/lib/rewrite/storage";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const record = await db.rewritePage.findFirst({
    where: { id, userId: session.uid },
    select: { id: true },
  });
  if (!record) return new Response("Not found", { status: 404 });

  const html = await readPageHtml(id);
  if (html === null) return new Response("Captured file is missing.", { status: 410 });

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-frame-options": "SAMEORIGIN",
    },
  });
}
