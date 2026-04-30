import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/server";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { currentPassword?: string; newPassword?: string };
  try { body = await request.json(); } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const current = body.currentPassword ?? "";
  const next = body.newPassword ?? "";
  if (next.length < 8) {
    return Response.json({ error: "New password must be at least 8 characters" }, { status: 400 });
  }
  if (next.length > 200) {
    return Response.json({ error: "New password too long" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { id: session.uid },
    select: { passwordHash: true },
  });
  if (!user) return Response.json({ error: "Account not found" }, { status: 404 });

  const ok = await verifyPassword(current, user.passwordHash);
  if (!ok) return Response.json({ error: "Current password is incorrect" }, { status: 400 });

  const newHash = await hashPassword(next);
  await db.user.update({
    where: { id: session.uid },
    data: { passwordHash: newHash },
  });

  return Response.json({ ok: true });
}
