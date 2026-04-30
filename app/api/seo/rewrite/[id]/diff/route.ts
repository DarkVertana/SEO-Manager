import { NextRequest } from "next/server";
import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/server";
import { readOriginalHtml, readPageHtml } from "@/lib/rewrite/storage";
import { SECTION_ATTR } from "@/lib/rewrite/sections";

export const runtime = "nodejs";

const SKIP_TAGS = new Set([
  "script", "style", "noscript", "code", "pre", "svg", "math", "template", "meta", "link",
]);
const MIN_TEXT_LENGTH = 2;

type Walked = { trimmed: string }[];

// Same deterministic walk as section-rewriter so node ids line up between
// original and current copies.
function collectTextNodes($: cheerio.CheerioAPI, root: cheerio.Cheerio<AnyNode>): Walked {
  const out: Walked = [];
  function walk(el: cheerio.Cheerio<AnyNode>) {
    el.contents().each((_, child) => {
      if (!child || typeof child !== "object") return;
      const c = child as { type?: string; name?: string; data?: string };
      if (c.type === "text") {
        const trimmed = (c.data ?? "").trim();
        if (trimmed.length < MIN_TEXT_LENGTH) return;
        if (!/[\p{L}]/u.test(trimmed)) return;
        out.push({ trimmed });
        return;
      }
      if (c.type === "tag" && c.name) {
        if (SKIP_TAGS.has(c.name.toLowerCase())) return;
        walk($(child as AnyNode));
      }
    });
  }
  walk(root);
  return out;
}

type SectionDiff = {
  index: number;
  heading: string | null;
  replacements: { id: number; before: string; text: string }[];
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const record = await db.rewritePage.findFirst({
    where: { id, userId: session.uid },
    select: { id: true },
  });
  if (!record) return Response.json({ error: "Not found" }, { status: 404 });

  const [originalHtml, currentHtml] = await Promise.all([
    readOriginalHtml(id),
    readPageHtml(id),
  ]);
  if (!originalHtml || !currentHtml) {
    return Response.json({ error: "Capture files are missing." }, { status: 410 });
  }

  const $orig = cheerio.load(originalHtml);
  const $cur = cheerio.load(currentHtml);

  const sections: SectionDiff[] = [];
  $orig(`[${SECTION_ATTR}]`).each((_, el) => {
    const $el = $orig(el);
    const idxRaw = $el.attr(SECTION_ATTR);
    const idx = Number(idxRaw);
    if (Number.isNaN(idx)) return;
    const $cur_el = $cur(`[${SECTION_ATTR}="${idx}"]`).first();
    if (!$cur_el.length) return;

    const before = collectTextNodes($orig, $el);
    const after = collectTextNodes($cur, $cur_el);

    const replacements: SectionDiff["replacements"] = [];
    const len = Math.min(before.length, after.length);
    for (let i = 0; i < len; i++) {
      if (before[i].trimmed !== after[i].trimmed) {
        replacements.push({ id: i, before: before[i].trimmed, text: after[i].trimmed });
      }
    }

    if (replacements.length === 0) return;

    const headingEl = $cur_el.find("h1, h2, h3, h4").first();
    const heading = headingEl.length ? headingEl.text().trim().slice(0, 120) || null : null;
    sections.push({ index: idx, heading, replacements });
  });

  return Response.json({ sections });
}
