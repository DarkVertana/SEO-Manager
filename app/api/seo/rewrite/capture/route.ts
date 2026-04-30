import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/server";
import { checkRewriteQuota } from "@/lib/auth/quota";
import { capturePage } from "@/lib/rewrite/capture";
import { tagSections } from "@/lib/rewrite/sections";
import {
  cleanupExpired,
  writePageHtml,
  writeOriginalIfMissing,
  REWRITE_TTL_DAYS,
} from "@/lib/rewrite/storage";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const quota = await checkRewriteQuota(session.uid);
  if (!quota.ok) return Response.json({ error: quota.reason }, { status: quota.status });

  let body: { url?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const url = body.url?.trim();
  if (!url) return Response.json({ error: "Please enter a URL." }, { status: 400 });

  let target: URL;
  try { target = new URL(url); } catch { return Response.json({ error: "That doesn't look like a valid URL." }, { status: 400 }); }
  if (!["http:", "https:"].includes(target.protocol)) {
    return Response.json({ error: "URL must start with http:// or https://" }, { status: 400 });
  }

  // Opportunistic cleanup of expired captures (10-day TTL)
  await cleanupExpired().catch(() => null);

  try {
    const captured = await capturePage(target.toString());
    const tagged = tagSections(captured.html);
    const expiresAt = new Date(Date.now() + REWRITE_TTL_DAYS * 24 * 60 * 60 * 1000);

    const record = await db.rewritePage.create({
      data: {
        userId: session.uid,
        url: target.toString(),
        title: captured.title,
        storagePath: "", // backfilled below
        byteSize: 0,
        expiresAt,
      },
    });

    // Asset URLs in the captured HTML are absolute, so the iframe loads
    // images, fonts, and icons straight from their upstream origin.
    const { size, path } = await writePageHtml(record.id, tagged.html);
    // Snapshot the freshly-tagged HTML as the immutable "original" — used by
    // the diff-based summary endpoint after the workspace is refreshed.
    await writeOriginalIfMissing(record.id, tagged.html);
    await db.rewritePage.update({
      where: { id: record.id },
      data: { storagePath: path, byteSize: size },
    });

    return Response.json({
      id: record.id,
      title: captured.title,
      cssInlined: captured.cssCount,
      sections: tagged.sections.length,
      byteSize: size,
      expiresAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "We couldn't capture that page. Please try again.";
    return Response.json({ error: message }, { status: 500 });
  }
}
