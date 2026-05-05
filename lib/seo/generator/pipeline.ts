// Brightdata-style SEO content generator pipeline, ported from
// brightdata/seo-article-generator (article_generator.py). Replaces:
//   - Bright Data MCP SERP scraping → user-supplied URLs (or competitor links
//     pulled from the captured page later)
//   - Bright Data MCP page fetch → existing fetchAndParse + cheerio
//   - OpenAI text-embedding-3-small + FAISS → GLM embeddings + cosine top-k
//   - LangChain OpenAI chat → GLM generateText (glm-5.1)
// Streams progress events so the UI mirrors the SSE pattern used by /rewrite.

import { embedTexts, generateText } from "../glm";
import { fetchAndParse } from "../parse-html";
import { chunkText } from "./chunker";
import { topK } from "./vector-search";
import type {
  ContentSummary,
  GenerateEvent,
  GenerateOutputType,
  SourceMeta,
  ThemeAnalysis,
} from "./types";

export async function* generateSeoContent(args: {
  keyword: string;
  urls: string[];
  outputType: GenerateOutputType;
  targetWordCount?: number;
}): AsyncGenerator<GenerateEvent> {
  const { keyword, urls, outputType } = args;
  const targetWordCount = args.targetWordCount ?? 1500;

  if (!keyword.trim()) {
    yield { type: "error", error: "Keyword is required." };
    return;
  }
  if (urls.length === 0) {
    yield { type: "error", error: "At least one source URL is required." };
    return;
  }

  // 1. Scrape sources
  yield { type: "scraping", total: urls.length };
  type Source = { url: string; title: string | null; content: string; position: number };
  const sources: Source[] = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      const parsed = await fetchAndParse(url);
      // bodyTextSample is already cleaned of script/style/nav/header/footer
      // and capped at 4500 chars in parse-html.ts. For richer research we want
      // the entire body text — refetch and re-extract a longer sample.
      const fullText = await extractFullText(url).catch(() => parsed.bodyTextSample);
      const content = (fullText && fullText.length > parsed.bodyTextSample.length)
        ? fullText
        : parsed.bodyTextSample;
      sources.push({
        url,
        title: parsed.title,
        content,
        position: i + 1,
      });
      yield {
        type: "scraped",
        url,
        title: parsed.title,
        length: content.length,
        index: i + 1,
        total: urls.length,
      };
    } catch (err) {
      yield {
        type: "scrape-error",
        url,
        error: err instanceof Error ? err.message : "Failed to fetch",
      };
    }
  }

  if (sources.length === 0) {
    yield { type: "error", error: "Could not scrape any of the supplied URLs." };
    return;
  }

  // 2. Chunk
  type Chunk = { text: string; url: string; title: string | null; position: number };
  const chunks: Chunk[] = [];
  for (const src of sources) {
    const split = chunkText(src.content, { chunkSize: 1000, chunkOverlap: 200 });
    for (const c of split) {
      chunks.push({ text: c, url: src.url, title: src.title, position: src.position });
    }
  }
  yield { type: "chunked", count: chunks.length };

  if (chunks.length === 0) {
    yield { type: "error", error: "Sources had no extractable text content." };
    return;
  }

  // 3. Embed all chunks (replaces FAISS.from_texts in brightdata)
  yield { type: "embedding", count: chunks.length };
  let chunkEmbeddings: number[][];
  try {
    chunkEmbeddings = await embedTexts(chunks.map((c) => c.text));
  } catch (err) {
    yield { type: "error", error: err instanceof Error ? err.message : "Embedding failed" };
    return;
  }

  // 4. Theme analysis — query terms = main keyword + top 3 tokens
  // (matches the brightdata `[keyword] + keyword.split()[:3]` pattern).
  const queryTerms = uniqueTerms([keyword, ...keyword.split(/\s+/).slice(0, 3)]);
  const queryEmbeddings = await embedTexts(queryTerms);
  const themes: ThemeAnalysis[] = [];
  for (let i = 0; i < queryTerms.length; i++) {
    const term = queryTerms[i];
    const queryEmb = queryEmbeddings[i];
    const matches = topK(queryEmb, chunkEmbeddings, 5);
    const relevantSources = new Set<string>();
    const passages: string[] = [];
    for (const m of matches) {
      relevantSources.add(chunks[m.idx].url);
      if (passages.length < 3) {
        passages.push(chunks[m.idx].text.slice(0, 200) + (chunks[m.idx].text.length > 200 ? "…" : ""));
      }
    }
    themes.push({
      term,
      relevantChunks: matches.length,
      keyPassages: passages,
      sources: [...relevantSources],
    });
  }

  // 5. Summary stats
  const totalWords = chunks.reduce((sum, c) => sum + c.text.split(/\s+/).filter(Boolean).length, 0);
  const summary: ContentSummary = {
    totalSources: new Set(chunks.map((c) => c.url)).size,
    totalChunks: chunks.length,
    totalWords,
    avgChunkLength: chunks.length > 0 ? Math.round((totalWords / chunks.length) * 10) / 10 : 0,
  };
  const sourceMeta: SourceMeta[] = sources.map((s) => ({
    url: s.url,
    title: s.title,
    position: s.position,
    contentLength: s.content.length,
  }));
  yield { type: "themes", themes, summary, sources: sourceMeta };

  // 6. Generate (replaces LangChain OpenAI chat)
  yield { type: "generating" };
  const themesText = formatThemesForPrompt(themes);
  const sourcesText = sources
    .map((s, i) => `${i + 1}. ${s.title ?? s.url} — ${s.url}`)
    .join("\n");

  const prompt = outputType === "outline"
    ? buildOutlinePrompt({ keyword, themesText, sourcesText, summary })
    : buildArticlePrompt({ keyword, themesText, sourcesText, summary, targetWordCount });

  let markdown: string;
  try {
    markdown = await generateText({
      systemInstruction: SYSTEM_INSTRUCTION,
      prompt,
      temperature: 0.7,
      maxOutputTokens: outputType === "outline" ? 1500 : Math.min(8000, Math.round(targetWordCount * 2.5)),
    });
  } catch (err) {
    yield { type: "error", error: err instanceof Error ? err.message : "Generation failed" };
    return;
  }

  yield { type: "done", markdown };
}

const SYSTEM_INSTRUCTION = `You are an SEO-focused content writer. You ONLY use the research passages and themes the user supplies — do not invent statistics, citations, or company-specific claims. Cite sources by number ([1], [2], …) when stating facts. Output clean GitHub-flavored markdown with proper heading hierarchy (one H1, descending H2/H3). Do not wrap the output in code fences.`;

function buildOutlinePrompt(args: {
  keyword: string;
  themesText: string;
  sourcesText: string;
  summary: ContentSummary;
}): string {
  return `Build a detailed SEO article outline for the keyword "${args.keyword}".

RESEARCH FOUNDATION
- Sources analyzed: ${args.summary.totalSources}
- Chunks indexed: ${args.summary.totalChunks}
- Total words: ${args.summary.totalWords}

KEY THEMES (semantic-search results from competitor passages)
${args.themesText}

NUMBERED SOURCES (use [1], [2], … to cite when claims trace to a specific source)
${args.sourcesText}

DELIVERABLE — produce a structured outline with:
1. Compelling H1 headline (50-60 chars, includes the primary keyword near the start)
2. Suggested meta description (150-160 chars)
3. Introduction — hook + scope statement (one paragraph blueprint, not full prose)
4. 4-6 H2 sections, each with 2-4 H3 subsections; under each H3 list 3-5 talking points anchored to the research themes (cite sources)
5. Conclusion — 3-5 takeaways
6. Suggested call-to-action
7. Suggested internal-link anchors (3-5)

Format the entire response as GitHub-flavored markdown.`;
}

function buildArticlePrompt(args: {
  keyword: string;
  themesText: string;
  sourcesText: string;
  summary: ContentSummary;
  targetWordCount: number;
}): string {
  return `Write a comprehensive ${args.targetWordCount}-word SEO article about "${args.keyword}". The article must be grounded in the research passages provided — never invent statistics or quotations.

RESEARCH FOUNDATION
- Sources analyzed: ${args.summary.totalSources}
- Chunks indexed: ${args.summary.totalChunks}
- Total words of corpus: ${args.summary.totalWords}

KEY THEMES (semantic-search results from competitor passages)
${args.themesText}

NUMBERED SOURCES (cite as [1], [2], … inline)
${args.sourcesText}

REQUIREMENTS
- One H1 (the article title). 50-60 chars. Primary keyword near beginning.
- A 150-160 char meta description on the second line, prefixed with "**Meta:** ".
- Introduction (~10% of word count) — hook + clear scope statement, primary keyword in first 100 words.
- 4-7 H2 sections with logical hierarchy (H2 → H3 only; no skipped levels).
- Each H2 should lead with a direct answer (40-60 word passage) so AI search engines can cite it.
- Use comparison tables for "X vs Y" content, numbered lists for processes, and bulleted lists for criteria.
- Inline citations [1], [2] when stating facts drawn from sources.
- Conclusion with 3-5 actionable takeaways.
- Avoid AI-writing tells: em-dash overuse (— used >1x signals AI), filler intensifiers (basically, very, really), and signal phrases ("In today's fast-paced world…", "Let's delve into…", "It's important to note that…").

Output ONLY the article in GitHub-flavored markdown. No preamble.`;
}

function formatThemesForPrompt(themes: ThemeAnalysis[]): string {
  return themes
    .map((t) => {
      const lines = [
        `**${t.term}** — ${t.relevantChunks} relevant passages across ${t.sources.length} source${t.sources.length === 1 ? "" : "s"}.`,
        ...t.keyPassages.slice(0, 3).map((p) => `  - ${p}`),
      ];
      return lines.join("\n");
    })
    .join("\n\n");
}

function uniqueTerms(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const term of arr) {
    const t = term.trim();
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out;
}

// Pull a longer body-text sample than parse-html's 4500-char default. Fetches
// the URL, strips noise tags, and returns up to 12k chars per source — gives
// the embedder enough material to find meaningful themes without exploding
// token costs.
async function extractFullText(url: string): Promise<string> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; SeoManagerBot/1.0; +https://seo-manager.local)",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) return "";
  const html = await res.text();
  // Strip script/style/nav/footer/header/aside before flattening
  const cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, " ")
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 12000);
}
