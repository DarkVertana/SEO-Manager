import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/server";
import { readPageHtml, writePageHtml } from "@/lib/rewrite/storage";
import { listSections, tagSections } from "@/lib/rewrite/sections";
import { rewriteSection } from "@/lib/rewrite/section-rewriter";
import { openScreenshotSession } from "@/lib/rewrite/screenshot";
import { parsePromptTargets } from "@/lib/rewrite/parse-prompt";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: { prompt?: string };
  try { body = await request.json(); } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const prompt = body.prompt?.trim();
  if (!prompt) return Response.json({ error: "Please type an instruction." }, { status: 400 });

  const record = await db.rewritePage.findFirst({
    where: { id, userId: session.uid },
    select: { id: true },
  });
  if (!record) return Response.json({ error: "Capture not found." }, { status: 404 });

  let html = await readPageHtml(id);
  if (html === null) return Response.json({ error: "Captured file is missing." }, { status: 410 });

  let sections = listSections(html);
  if (sections.length === 0) {
    const tagged = tagSections(html);
    sections = tagged.sections;
    html = tagged.html;
    await writePageHtml(id, html);
  }

  // Parse @section targeting out of the prompt. If the user wrote
  // "@section3 @section5 …", limit the run to those sections only.
  const { targetIndices, cleaned, rawHits } = parsePromptTargets(prompt!);
  if (targetIndices !== null) {
    sections = sections.filter((s) => targetIndices.has(s.index));
    if (sections.length === 0) {
      return Response.json(
        {
          error: `None of the @section targets matched. This page has ${listSections(html).length} sections (numbered 1 onwards).`,
        },
        { status: 400 },
      );
    }
  }
  if (rawHits > 0 && cleaned.length === 0) {
    return Response.json(
      { error: "Please describe what to change after the @section selector(s)." },
      { status: 400 },
    );
  }
  const promptForGemini = cleaned.length > 0 ? cleaned : prompt!;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      if (sections.length === 0) {
        send({ type: "ready", total: 0 });
        send({ type: "done", note: "No content sections detected." });
        controller.close();
        return;
      }

      // Spin up Chromium ONCE for the whole run instead of per section.
      // setContent + network settle is the slow chunk; doing it once turns
      // each subsequent section screenshot into a millisecond-class call.
      send({
        type: "session-prepare",
        total: sections.length,
        indices: sections.map((s) => s.index),
        targeted: targetIndices !== null,
      });
      const screenshotSession = await openScreenshotSession(html!);
      send({
        type: "ready",
        total: sections.length,
        indices: sections.map((s) => s.index),
        targeted: targetIndices !== null,
      });

      let workingHtml = html!;
      try {
        for (const section of sections) {
          // Strict per-section pipeline: analyze → generate → replace.
          send({ type: "section-analyzing", index: section.index, total: sections.length });
          let screenshot: Buffer | null = null;
          try {
            screenshot = await screenshotSession.screenshot(section.selector);
          } catch {
            screenshot = null;
          }

          send({ type: "section-generating", index: section.index, total: sections.length });
          try {
            const result = await rewriteSection({
              html: workingHtml,
              selector: section.selector,
              prompt: promptForGemini,
              screenshot,
            });
            workingHtml = result.html;

            send({ type: "section-replacing", index: section.index, total: sections.length });
            await writePageHtml(id, workingHtml);
            await db.rewritePage.update({
              where: { id },
              data: { byteSize: Buffer.byteLength(workingHtml, "utf8"), updatedAt: new Date() },
            });

            send({
              type: "section-complete",
              index: section.index,
              total: sections.length,
              selector: section.selector,
              heading: result.heading,
              rewritten: result.rewrittenCount,
              totalText: result.totalText,
              hadScreenshot: result.hadScreenshot,
              replacements: result.replacements,
            });
          } catch (err) {
            send({
              type: "section-error",
              index: section.index,
              total: sections.length,
              error: err instanceof Error ? err.message : "Unknown error",
            });
          }
        }
      } finally {
        await screenshotSession.close();
      }

      send({ type: "done", total: sections.length });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
