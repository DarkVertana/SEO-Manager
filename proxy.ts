import { NextResponse, type NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth/session";

const PUBLIC_PATHS = ["/login", "/register"];
const PUBLIC_API_PREFIXES = ["/api/auth/"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return false;
}

export async function proxy(req: NextRequest) {
  // Wrap the entire flow so any thrown error (e.g. AUTH_SECRET unset on the
  // deploy and verifySession crashes) falls through to the page renderer
  // instead of bubbling up as a platform-level 404 / 500.
  try {
    const { pathname } = req.nextUrl;
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    let session = null;
    try {
      session = await verifySession(token);
    } catch {
      session = null;
    }

    if (isPublic(pathname)) {
      if (session && (pathname === "/login" || pathname === "/register")) {
        const url = req.nextUrl.clone();
        url.pathname = "/";
        return NextResponse.redirect(url);
      }
      return NextResponse.next();
    }

    if (!session) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("from", pathname);
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
