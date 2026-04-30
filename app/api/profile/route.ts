import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/server";

export const runtime = "nodejs";

// PATCH — update display name only. Email/password have dedicated handlers
// (email isn't editable here, password lives at /api/profile/password).
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: string };
  try { body = await request.json(); } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (name.length > 80) {
    return Response.json({ error: "Name must be 80 characters or less" }, { status: 400 });
  }

  await db.user.update({
    where: { id: session.uid },
    data: { name: name.length === 0 ? null : name },
  });

  return Response.json({ ok: true });
}
