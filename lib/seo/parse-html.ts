import * as cheerio from "cheerio";
import type { ParsedPage, RobotsInfo, SitemapInfo } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (compatible; SeoManagerBot/1.0; +https://seo-manager.local)";

export async function fetchAndParse(url: string): Promise<ParsedPage> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
  });

  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);

  const html = await res.text();
  const contentType = res.headers.get("content-type");
  return parseHtml(html, url, res.status, contentType);
}

const JS_FRAMEWORK_HINTS: { name: string; signal: RegExp }[] = [
  { name: "Next.js", signal: /__NEXT_DATA__|_next\/static/i },
  { name: "React", signal: /data-reactroot|react-dom/i },
  { name: "Vue", signal: /data-v-[a-z0-9]{8}|__vue_app__/i },
  { name: "Angular", signal: /ng-version=|<app-root/i },
  { name: "Svelte", signal: /svelte-/i },
  { name: "Nuxt", signal: /__NUXT__|_nuxt\//i },
  { name: "Astro", signal: /astro-island|data-astro-cid/i },
];

export function parseHtml(
  html: string,
  baseUrl: string,
  status = 200,
  contentType: string | null = null,
): ParsedPage {
  const $ = cheerio.load(html);
  const base = new URL(baseUrl);

  const openGraph: Record<string, string> = {};
  const twitterCard: Record<string, string> = {};
  let metaDescription: string | null = null;
  let metaRobots: string | null = null;
  let charset: string | null = null;
  let viewport: string | null = null;

  $("meta").each((_, el) => {
    const name = ($(el).attr("name") ?? "").toLowerCase();
    const property = ($(el).attr("property") ?? "").toLowerCase();
    const content = $(el).attr("content") ?? "";
    if (name === "description") metaDescription = content;
    if (name === "robots") metaRobots = content;
    if (name === "viewport") viewport = content;
    if ($(el).attr("charset")) charset = $(el).attr("charset") ?? null;
    if (property.startsWith("og:")) openGraph[property] = content;
    if (name.startsWith("twitter:")) twitterCard[name] = content;
  });

  const headings = (tag: "h1" | "h2" | "h3") =>
    $(tag).map((_, el) => $(el).text().trim()).get().filter((t) => t.length > 0);

  const images = $("img")
    .map((_, el) => {
      const src = $(el).attr("src") ?? "";
      let absSrc = src;
      try { absSrc = src ? new URL(src, base).toString() : ""; } catch { absSrc = src; }
      return {
        src: absSrc,
        alt: $(el).attr("alt") ?? null,
        width: $(el).attr("width") ?? null,
        height: $(el).attr("height") ?? null,
        loading: $(el).attr("loading") ?? null,
        fetchpriority: $(el).attr("fetchpriority") ?? null,
        decoding: $(el).attr("decoding") ?? null,
      };
    })
    .get();

  let internal = 0;
  let external = 0;
  let nofollow = 0;
  const linkSample: { href: string; text: string }[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
    try {
      const u = new URL(href, base);
      const rel = ($(el).attr("rel") ?? "").toLowerCase();
      if (rel.includes("nofollow")) nofollow++;
      if (u.hostname === base.hostname) internal++; else external++;
      if (linkSample.length < 30) {
        linkSample.push({ href: u.toString(), text: $(el).text().trim().slice(0, 80) });
      }
    } catch { /* ignore malformed URLs */ }
  });

  const schema: unknown[] = [];
  const schemaTypes = new Set<string>();
  const collect = (item: unknown) => {
    if (item && typeof item === "object") {
      schema.push(item);
      const t = (item as { "@type"?: unknown })["@type"];
      if (typeof t === "string") schemaTypes.add(t);
      else if (Array.isArray(t)) t.forEach((tt) => typeof tt === "string" && schemaTypes.add(tt));
    }
  };
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    try {
      const data = JSON.parse(raw);
      if (data && typeof data === "object" && "@graph" in data && Array.isArray(data["@graph"])) {
        for (const item of data["@graph"]) collect(item);
      } else if (Array.isArray(data)) {
        for (const item of data) collect(item);
      } else { collect(data); }
    } catch { /* skip invalid JSON-LD */ }
  });

  const hreflang = $('link[rel="alternate"][hreflang]')
    .map((_, el) => ({ lang: $(el).attr("hreflang") ?? "", href: $(el).attr("href") ?? null }))
    .get();

  const canonical = $('link[rel="canonical"]').attr("href") ?? null;
  const lang = $("html").attr("lang") ?? null;

  const $body = $("body").clone();
  $body.find("script, style, nav, footer, header").remove();
  const bodyText = $body.text().replace(/\s+/g, " ").trim();
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;

  const detectedFrameworks: string[] = [];
  for (const fw of JS_FRAMEWORK_HINTS) if (fw.signal.test(html)) detectedFrameworks.push(fw.name);

  return {
    url: baseUrl,
    status,
    title: $("title").first().text().trim() || null,
    metaDescription,
    metaRobots,
    canonical,
    lang,
    viewport,
    charset,
    contentType,
    isHttps: base.protocol === "https:",
    h1: headings("h1"),
    h2: headings("h2"),
    h3: headings("h3"),
    images,
    links: { internal, external, nofollow, sample: linkSample },
    schema,
    schemaTypes: [...schemaTypes],
    openGraph,
    twitterCard,
    hreflang,
    wordCount,
    hasJsFramework: detectedFrameworks.length > 0,
    jsFrameworks: detectedFrameworks,
    bodyTextSample: bodyText.slice(0, 4500),
  };
}

export async function fetchRobots(siteUrl: string): Promise<RobotsInfo> {
  const root = new URL(siteUrl);
  const robotsUrl = `${root.protocol}//${root.host}/robots.txt`;
  try {
    const res = await fetch(robotsUrl, { headers: { "user-agent": USER_AGENT } });
    if (!res.ok) {
      return {
        exists: false,
        url: robotsUrl,
        status: res.status,
        body: null,
        allowsCommonCrawlers: true,
        blocksAiCrawlers: [],
        sitemapUrls: [],
      };
    }
    const body = await res.text();
    const sitemapUrls = [...body.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]);

    // Detect AI crawler blocks (Disallow: / for specific UAs)
    const aiTokens = [
      "GPTBot",
      "ChatGPT-User",
      "OAI-SearchBot",
      "ClaudeBot",
      "anthropic-ai",
      "PerplexityBot",
      "Google-Extended",
      "CCBot",
      "Bytespider",
      "cohere-ai",
    ];
    const blocked: string[] = [];
    const blocks = body.split(/\n(?=\s*User-agent:)/i);
    for (const block of blocks) {
      const uaMatch = block.match(/User-agent:\s*(\S+)/i);
      if (!uaMatch) continue;
      const ua = uaMatch[1];
      if (aiTokens.some((t) => t.toLowerCase() === ua.toLowerCase())) {
        if (/Disallow:\s*\/\s*(\n|$)/i.test(block)) blocked.push(ua);
      }
    }

    const allowsCommonCrawlers = !/User-agent:\s*\*[\s\S]*?Disallow:\s*\/\s*(\n|$)/i.test(body);

    return {
      exists: true,
      url: robotsUrl,
      status: res.status,
      body: body.slice(0, 4000),
      allowsCommonCrawlers,
      blocksAiCrawlers: blocked,
      sitemapUrls,
    };
  } catch {
    return {
      exists: false,
      url: robotsUrl,
      status: null,
      body: null,
      allowsCommonCrawlers: true,
      blocksAiCrawlers: [],
      sitemapUrls: [],
    };
  }
}

export async function fetchSitemap(
  siteUrl: string,
  robots: RobotsInfo,
): Promise<SitemapInfo> {
  const root = new URL(siteUrl);
  const candidates = robots.sitemapUrls.length
    ? robots.sitemapUrls
    : [`${root.protocol}//${root.host}/sitemap.xml`];
  for (const candidate of candidates) {
    try {
      const res = await fetch(candidate, { headers: { "user-agent": USER_AGENT } });
      if (!res.ok) continue;
      const body = await res.text();
      const isIndex = /<sitemapindex/i.test(body);
      const tag = isIndex ? "sitemap" : "url";
      const urls = [...body.matchAll(new RegExp(`<${tag}>[\\s\\S]*?<loc>(.*?)<\\/loc>`, "gi"))].map(
        (m) => m[1].trim(),
      );
      return {
        exists: true,
        url: candidate,
        status: res.status,
        urlCount: urls.length,
        preview: urls.slice(0, 20),
        isIndex,
      };
    } catch { /* try next */ }
  }
  return { exists: false, url: null, status: null, urlCount: null, preview: [], isIndex: false };
}
