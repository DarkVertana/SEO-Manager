import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/server";
import { deletePageDir } from "@/lib/rewrite/storage";

export const runtime = "nodejs";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify ownership before destroying anything on disk.
  const record = await db.rewritePage.findFirst({
    where: { id, userId: session.uid },
    select: { id: true },
  });
  if (!record) return Response.json({ error: "Not found" }, { status: 404 });

  await deletePageDir(id).catch(() => null);
  await db.rewritePage.delete({ where: { id } });

  return Response.json({ ok: true });
}
