// Rewrite is temporarily disabled at the surface
// (see app/(app)/rewrite-content). This API is kept mounted so any stale
// client receives a clear 503 instead of crashing on a missing route.
// Restore the original implementation from git history when re-enabling.

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST() {
  return Response.json(
    { error: "/seo rewrite is temporarily unavailable." },
    { status: 503 },
  );
}
