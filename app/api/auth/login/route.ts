import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/server";

export const runtime = "nodejs";

const INVALID_CREDENTIALS =
  "We couldn't find an account matching that email and password. Please double-check and try again.";

export async function POST(request: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Something went wrong. Please refresh the page and try again." },
      { status: 400 },
    );
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  if (!email || !password) {
    return Response.json({ error: "Please enter your email and password." }, { status: 400 });
  }

  try {
    const user = await db.user.findUnique({ where: { email } });
    if (!user) return Response.json({ error: INVALID_CREDENTIALS }, { status: 401 });

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return Response.json({ error: INVALID_CREDENTIALS }, { status: 401 });

    await setSessionCookie({ uid: user.id, email: user.email, role: user.role });
    return Response.json({ user: { id: user.id, email: user.email, name: user.name } });
  } catch {
    return Response.json(
      { error: "We couldn't sign you in right now. Please try again in a moment." },
      { status: 500 },
    );
  }
}
