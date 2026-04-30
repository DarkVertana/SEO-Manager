import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/server";
import { checkPassword, isValidEmail } from "@/lib/auth/validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: { email?: string; password?: string; name?: string };
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
  const name = body.name?.trim() || null;

  if (!email || !isValidEmail(email)) {
    return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const passwordCheck = checkPassword(password);
  if (!passwordCheck.ok) {
    return Response.json({ error: passwordCheck.message }, { status: 400 });
  }

  try {
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return Response.json(
        { error: "An account with this email already exists. Try signing in instead." },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(password);
    const user = await db.user.create({
      data: { email, passwordHash, name },
      select: { id: true, email: true, name: true, role: true },
    });

    await setSessionCookie({ uid: user.id, email: user.email, role: user.role });
    return Response.json({ user: { id: user.id, email: user.email, name: user.name } });
  } catch {
    return Response.json(
      { error: "We couldn't create your account right now. Please try again in a moment." },
      { status: 500 },
    );
  }
}
