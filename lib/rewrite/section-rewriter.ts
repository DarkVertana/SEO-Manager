// Section rewriter:
//   1. Screenshot the section (Playwright clip).
//   2. Extract every visible text node from that section subtree.
//   3. Send screenshot + JSON of texts + user instruction to Gemini Vision.
//   4. Apply rewritten text in place — only `data` of text nodes changes.

import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { Type, type Schema } from "@google/genai";
import { getGemini, GEMINI_MODEL } from "@/lib/seo/gemini";

const SKIP_TAGS = new Set([
  "script", "style", "noscript", "code", "pre", "svg", "math", "template", "meta", "link",
]);
const MIN_TEXT_LENGTH = 2;

const REWRITE_SCHEMA: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.INTEGER },
      text: { type: Type.STRING },
    },
    required: ["id", "text"],
    propertyOrdering: ["id", "text"],
  },
};

const SYSTEM = `You are a copy-only rewriter for a single section of a webpage.

You receive:
  (1) A SCREENSHOT of the section as it currently renders, so you can see its design, hierarchy, and the visible character/line constraints of every label, button, heading, and paragraph.
  (2) A JSON array of text snippets currently visible in that section, each with a numeric id.
  (3) A user instruction in plain English describing how to change the wording.

Hard rules:
- Apply the user's instruction to each snippet.
- Return a JSON array with EVERY id from the input and the rewritten text. If a snippet does not need to change, return it unchanged.
- Match the visible character budget shown in the screenshot. If the screenshot shows a button labelled "Sign Up" (~7 chars), do not return "Sign up for our amazing newsletter today". Stay within the visible space; clip or condense if needed. For headlines and short labels, keep within ±20% of original length.
- Output ONLY plain text. No HTML, no markdown, no asterisks, no quotes wrapping.
- Do not invent or alter URLs, brand names, product codes, prices, or numbers unless the instruction explicitly says so.
- Input and output arrays must have the same number of items, matched by id. Do not merge or split.`;

type TextNodeRef = {
  id: number;
  trimmed: string;
  node: { data: string; type: string };
};

function collectTextNodesIn(
  $: cheerio.CheerioAPI,
  root: cheerio.Cheerio<AnyNode>,
): TextNodeRef[] {
  const collected: TextNodeRef[] = [];
  function walk(el: cheerio.Cheerio<AnyNode>) {
    el.contents().each((_, child) => {
      if (!child || typeof child !== "object") return;
      const c = child as { type?: string; name?: string; data?: string };
      if (c.type === "text") {
        const raw = c.data ?? "";
        const trimmed = raw.trim();
        if (trimmed.length < MIN_TEXT_LENGTH) return;
        if (!/[\p{L}]/u.test(trimmed)) return;
        collected.push({
          id: collected.length,
          trimmed,
          node: c as { data: string; type: string },
        });
        return;
      }
      if (c.type === "tag" && c.name) {
        if (SKIP_TAGS.has(c.name.toLowerCase())) return;
        walk($(child as AnyNode));
      }
    });
  }
  walk(root);
  return collected;
}

function preserveWhitespace(original: string, replacement: string): string {
  const leading = original.match(/^\s*/)?.[0] ?? "";
  const trailing = original.match(/\s*$/)?.[0] ?? "";
  return leading + replacement + trailing;
}

export type SectionRewriteResult = {
  selector: string;
  rewrittenCount: number;
  totalText: number;
  hadScreenshot: boolean;
  html: string;
  // Best-effort label so the PDF / dev hand-off can title each section
  // with something more useful than "Section N".
  heading: string | null;
  // Deltas the iframe bootstrap can apply live without a reload.
  // `id` matches the deterministic walk order shared with the iframe.
  // `before` is included so the workspace can render a side-by-side diff
  // and the downloadable summary PDF can list each pair.
  replacements: { id: number; before: string; text: string }[];
};

export async function rewriteSection(args: {
  html: string;
  selector: string;
  prompt: string;
  screenshot?: Buffer | null;
}): Promise<SectionRewriteResult> {
  const $ = cheerio.load(args.html);
  const root = $(args.selector).first();
  if (!root.length) {
    return {
      selector: args.selector,
      rewrittenCount: 0,
      totalText: 0,
      hadScreenshot: false,
      html: args.html,
      heading: null,
      replacements: [],
    };
  }

  // Pick a label from the first heading in this section, falling back to the
  // first non-trivial text node so the rewrite summary always has something.
  const headingEl = root.find("h1, h2, h3, h4").first();
  const heading = headingEl.length
    ? headingEl.text().trim().slice(0, 120) || null
    : null;

  const nodes = collectTextNodesIn($, root);
  if (nodes.length === 0) {
    return {
      selector: args.selector,
      rewrittenCount: 0,
      totalText: 0,
      hadScreenshot: false,
      html: args.html,
      heading,
      replacements: [],
    };
  }

  const screenshot = args.screenshot ?? null;
  const payload = nodes.map((n) => ({ id: n.id, text: n.trimmed }));

  const ai = getGemini();
  const userParts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] = [];
  if (screenshot) {
    userParts.push({
      inlineData: { mimeType: "image/png", data: screenshot.toString("base64") },
    });
  }
  userParts.push({
    text: `User instruction: ${args.prompt}\n\nText snippets in this section (return all with rewritten text):\n${JSON.stringify(payload)}`,
  });

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: userParts }],
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: "application/json",
      responseSchema: REWRITE_SCHEMA,
      temperature: 0.4,
    },
  });

  const raw = response.text;
  if (!raw) throw new Error("Empty response from rewrite engine.");
  const result = JSON.parse(raw) as { id: number; text: string }[];
  const map = new Map(result.map((r) => [r.id, r.text ?? ""]));

  let changed = 0;
  const replacements: { id: number; before: string; text: string }[] = [];
  for (const ref of nodes) {
    const next = map.get(ref.id);
    if (typeof next !== "string") continue;
    if (next.trim() === ref.trimmed) continue;
    const before = ref.trimmed;
    ref.node.data = preserveWhitespace(ref.node.data, next);
    replacements.push({ id: ref.id, before, text: next });
    changed++;
  }

  return {
    selector: args.selector,
    rewrittenCount: changed,
    totalText: nodes.length,
    hadScreenshot: !!screenshot,
    html: $.html(),
    heading,
    replacements,
  };
}
