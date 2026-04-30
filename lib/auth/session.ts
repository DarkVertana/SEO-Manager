import { jwtVerify, SignJWT } from "jose";

const COOKIE_NAME = "session";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type SessionRole = "user" | "admin";

export type SessionPayload = {
  uid: string;
  email: string;
  // UI hint only — sensitive routes must re-verify against the DB so a revoked
  // admin loses access immediately even with an unexpired JWT in their cookie.
  role: SessionRole;
};

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${COOKIE_MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.uid === "string" && typeof payload.email === "string") {
      const role: SessionRole = payload.role === "admin" ? "admin" : "user";
      return { uid: payload.uid, email: payload.email, role };
    }
    return null;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = COOKIE_NAME;
export const SESSION_MAX_AGE = COOKIE_MAX_AGE_SECONDS;
