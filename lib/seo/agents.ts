// Per-skill analyzers. Prompts are derived from coreyhaines31/marketingskills:
//   skills/seo-audit/SKILL.md
//   skills/seo-audit/references/ai-writing-detection.md
//   skills/seo-audit/references/international-seo.md
//   skills/ai-seo/SKILL.md (Princeton GEO research, content patterns, platform factors)
//   skills/schema-markup/SKILL.md
// Where marketingskills delegates to other skills (e.g. ai-seo from seo-audit), we
// follow the same delegation in the parent orchestrator (lib/seo/audit.ts).

import { generateJson } from "./glm";
import {
  architectureReportSchema,
  categoryReportSchema,
  contentReportSchema,
  industryDetectionSchema,
  pageReportSchema,
  programmaticReportSchema,
  schemaReportSchema,
} from "./schemas";
import type {
  ArchitectureReport,
  CategoryReport,
  EeatBreakdown,
  IndustryDetection,
  ParsedPage,
  ProgrammaticReport,
  RobotsInfo,
  SitemapInfo,
} from "./types";
import {
  AI_CITED_CONTENT_TYPES,
  AI_CONTENT_BLOCKS,
  AI_PLATFORM_FACTORS,
  AI_WRITING_TELLS,
  AUDIT_PRIORITY_ORDER,
  CWV_THRESHOLDS,
  DATA_DEFENSIBILITY_HIERARCHY,
  EEAT_WEIGHTS,
  GEO_OPTIMIZATION_METHODS,
  HREFLANG_RULES,
  MACHINE_READABLE_FILES,
  META_DESC_RULES,
  NAV_RULES,
  PAGE_TYPE_MIN_WORDS,
  PROGRAMMATIC_COMMON_MISTAKES,
  PROGRAMMATIC_CORE_PRINCIPLES,
  PROGRAMMATIC_PLAYBOOKS,
  PROGRAMMATIC_PRELAUNCH_CHECKLIST,
  type ProgrammaticPlaybook,
  SCHEMA_DEPRECATED,
  SCHEMA_RESTRICTED,
  SITE_TYPE_COMMON_ISSUES,
  SITE_TYPE_DEPTH,
  TITLE_RULES,
  URL_COMMON_MISTAKES,
  URL_DESIGN_PRINCIPLES,
  URL_PATTERNS_BY_PAGE_TYPE,
} from "./references";

const COMMON_RULES = `Hard rules (apply globally):
- Audit priority order (marketingskills/seo-audit): ${AUDIT_PRIORITY_ORDER.join(" → ")}.
- Core Web Vitals reference INP, never FID. INP replaced FID 2024-03-12; FID removed from CrUX/PSI/Lighthouse 2024-09-09.
- Never recommend HowTo schema (rich results removed Sept 2023).
- FAQPage rich results: only government and healthcare authority sites (Aug 2023). Existing FAQPage on commercial sites — flag at Info priority (not Critical) and note AI/LLM citation upside. Adding new FAQPage for Google benefit: not recommended; acceptable only if AI visibility is a stated priority.
- Never recommend SpecialAnnouncement (deprecated July 2025), CourseInfo, EstimatedSalary, LearningVideo, ClaimReview, VehicleListing, Practice Problem, or Dataset (all retired in 2025).
- Mobile-first indexing is 100% complete (July 5, 2024). Google indexes ALL sites with mobile Googlebot only.
- December 2025 core update extended E-E-A-T evaluation to ALL competitive queries, not just YMYL.
- Schema detection caveat: cheerio-parsed HTML may MISS JS-injected JSON-LD (AIOSEO, Yoast, RankMath inject via client JS). When schema is absent, prefer "warn" over "fail" on first pass and recommend Rich Results Test for ground truth.

Issue output format (every issue must have):
- Issue: what is wrong (specific values from the page)
- Impact: why it matters
- Evidence: where you saw it
- Fix: specific, actionable recommendation
- Priority: Critical | High | Medium | Low
- Effort: low | medium | high

Priority levels:
- Critical: blocks indexing or causes penalties (fix immediately)
- High: significantly impacts rankings (fix within 1 week)
- Medium: optimization opportunity (fix within 1 month)
- Low: nice to have (backlog)

Status values for findings: pass, warn, fail.`;

function pageBrief(parsed: ParsedPage): string {
  return `URL: ${parsed.url}
HTTP Status: ${parsed.status}
HTTPS: ${parsed.isHttps}
Content-Type: ${parsed.contentType ?? "(unknown)"}
Lang: ${parsed.lang ?? "(missing)"}
Viewport: ${parsed.viewport ?? "(missing)"}
Charset: ${parsed.charset ?? "(missing)"}
Title (${parsed.title?.length ?? 0} chars): ${parsed.title ?? "(missing)"}
Meta Description (${parsed.metaDescription?.length ?? 0} chars): ${parsed.metaDescription ?? "(missing)"}
Meta Robots: ${parsed.metaRobots ?? "(default)"}
Canonical: ${parsed.canonical ?? "(missing)"}
H1 (${parsed.h1.length}): ${JSON.stringify(parsed.h1).slice(0, 600)}
H2 (${parsed.h2.length}): ${JSON.stringify(parsed.h2).slice(0, 600)}
H3 count: ${parsed.h3.length}
Word count: ${parsed.wordCount}
Internal links: ${parsed.links.internal} | External: ${parsed.links.external} | Nofollow: ${parsed.links.nofollow}
Images: ${parsed.images.length} (missing alt: ${parsed.images.filter((i) => !i.alt).length}, missing dimensions: ${parsed.images.filter((i) => !i.width || !i.height).length}, lazy: ${parsed.images.filter((i) => i.loading === "lazy").length})
Open Graph keys: ${Object.keys(parsed.openGraph).join(", ") || "(none)"}
Twitter Card keys: ${Object.keys(parsed.twitterCard).join(", ") || "(none)"}
Hreflang entries: ${parsed.hreflang.length}${parsed.hreflang.length ? ` — ${JSON.stringify(parsed.hreflang).slice(0, 600)}` : ""}
JSON-LD blocks: ${parsed.schema.length} (types: ${parsed.schemaTypes.join(", ") || "none"})
JS Frameworks detected: ${parsed.jsFrameworks.join(", ") || "(none)"}
Body sample: """${parsed.bodyTextSample.slice(0, 1500)}"""`;
}

// --- Industry detection (marketingskills/seo-audit "Common Issues by Site Type") ---

const INDUSTRY_PROMPT = `You detect a website's primary business type from homepage signals so the audit can apply site-type-specific issue lists.

Detection rules:
- SaaS: pricing page, /features, /integrations, /docs, "free trial", "sign up"
- Local Service: phone number, address, service area, "serving [city]", Google Maps embed
- E-commerce: /products, /collections, /cart, "add to cart", Product/Offer JSON-LD
- Publisher: /blog, /articles, /topics, Article/BlogPosting/NewsArticle schema, author pages, dates
- Agency: /case-studies, /portfolio, /industries, "our work", client logos
- Other: none of the above clearly dominates

Also classify the page type observed (Homepage, Service Page, Blog Post, Product Page, Category Page, Location Page, About Page, Landing Page, FAQ Page, Other).

If the top two categories are close, set confidence "low" and list both in signals.`;

export async function detectIndustry(parsed: ParsedPage): Promise<IndustryDetection> {
  return generateJson<IndustryDetection>({
    systemInstruction: `${INDUSTRY_PROMPT}\n\n${COMMON_RULES}`,
    schema: industryDetectionSchema,
    prompt: `Classify this page.\n\n${pageBrief(parsed)}`,
    temperature: 0.1,
  });
}

// --- Technical SEO (marketingskills/seo-audit "Technical SEO Audit") ---

const TECHNICAL_PROMPT = `You are the technical SEO auditor (marketingskills/seo-audit "Technical SEO Audit"). Walk these checks IN ORDER (this is the marketingskills priority funnel):

1. CRAWLABILITY
   - Robots.txt: present, no unintentional blocks of important pages, sitemap reference present.
   - XML Sitemap: exists, accessible, contains only canonical/indexable URLs, correctly formatted.
   - Site Architecture proxy: important pages within 3 clicks of homepage (judge from internal-link breadth).
   - Crawl-budget hazards: parameterized URLs, faceted nav, infinite scroll without pagination fallback, session IDs in URLs.

2. INDEXATION
   - Noindex on important pages.
   - Canonicals: present, self-referencing on unique pages, point in the right direction (HTTP→HTTPS, www consistency).
   - Redirect chains/loops, soft 404s, duplicate content without canonicals.

3. SECURITY & HTTPS
   - HTTPS site-wide, valid SSL (assume valid if served over HTTPS), no mixed content (flag if absolute http:// in body sample).
   - Bonus headers: HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy (mark "not measurable from HTML alone" if unknown).

4. URL STRUCTURE
   - Readable, descriptive URL (not /p/12345); hyphens not underscores; lowercase; no parameters for content URLs; consistent trailing-slash policy.

5. MOBILE-FRIENDLINESS (Mobile-first indexing is 100% complete since July 5, 2024)
   - Viewport meta present and correct; responsive (no fixed-width signals); same content as desktop; tap targets ≥48x48px; font ≥16px.

6. CORE WEB VITALS — infer RISK from HTML signals only (you cannot measure field data):
   - LCP risk: huge unoptimized hero, render-blocking CSS/JS, missing fetchpriority="high" on hero, late-loading hero, font-display not configured. Threshold: ${CWV_THRESHOLDS.LCP.good}.
   - INP risk: heavy JS payload, SPA framework with no SSR, many third-party scripts, no defer/async on script tags. Threshold: ${CWV_THRESHOLDS.INP.good}.
   - CLS risk: images without width/height, ads/embeds without reserved space, late-loading content, fonts without font-display: swap. Threshold: ${CWV_THRESHOLDS.CLS.good}.

7. JAVASCRIPT RENDERING
   - If a JS framework is detected, flag whether the body sample contains sufficient pre-rendered text. Per Dec 2025 Google JS SEO guidance: serve canonical/robots/structured data in initial server-rendered HTML.

8. STRUCTURED DATA — high-level pass only; full audit handled by the schema specialist.

9. AI CRAWLER MANAGEMENT
   - Note any blocks of GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, anthropic-ai, PerplexityBot, Google-Extended, Bingbot.
   - Reminder: blocking Google-Extended does NOT affect Google Search rankings (it gates Gemini training/AI Overviews). Blocking GPTBot does NOT block ChatGPT browsing (that's ChatGPT-User).

Return a 0-100 technical category score. Findings should map 1:1 to the nine sections above with status pass/warn/fail. Issues must be specific (cite the URL, the missing tag, the exact value).`;

export async function runTechnical(args: {
  parsed: ParsedPage;
  robots: RobotsInfo;
  sitemap: SitemapInfo;
}): Promise<CategoryReport> {
  const { parsed, robots, sitemap } = args;
  const robotsSummary = robots.exists
    ? `robots.txt found (status ${robots.status}); allows-common-crawlers: ${robots.allowsCommonCrawlers}; AI crawlers blocked: ${robots.blocksAiCrawlers.join(", ") || "none"}; sitemap directives: ${robots.sitemapUrls.length}`
    : `robots.txt NOT found at ${robots.url}`;
  const sitemapSummary = sitemap.exists
    ? `sitemap found at ${sitemap.url} (status ${sitemap.status}, ${sitemap.urlCount ?? 0} entries, isIndex: ${sitemap.isIndex})`
    : `sitemap NOT found`;

  return generateJson<CategoryReport>({
    systemInstruction: `${TECHNICAL_PROMPT}\n\n${COMMON_RULES}`,
    schema: categoryReportSchema,
    prompt: `${pageBrief(parsed)}\n\nRobots: ${robotsSummary}\nSitemap: ${sitemapSummary}\n\nProduce the technical audit.`,
  });
}

// --- Content + E-E-A-T + AI writing detection (marketingskills/seo-audit "Content Quality Assessment" + ai-writing-detection.md) ---

const CONTENT_PROMPT = `You are the content quality auditor (marketingskills/seo-audit "Content Quality Assessment").

Apply September 2025 Google Quality Rater Guidelines (E-E-A-T) plus the December 2025 core update which extended E-E-A-T to ALL competitive queries (not just YMYL).

E-E-A-T weights: Experience ${EEAT_WEIGHTS.Experience * 100}%, Expertise ${EEAT_WEIGHTS.Expertise * 100}%, Authoritativeness ${EEAT_WEIGHTS.Authoritativeness * 100}%, Trustworthiness ${EEAT_WEIGHTS.Trustworthiness * 100}% (Trust = most important).

For each E-E-A-T pillar, score 0-100 and list observable signals (or absence of signals) from the parsed page. Specific signal classes:
- Experience: first-hand examples, original screenshots, "we tried this and…" framing, real case studies.
- Expertise: author credentials, accurate detail, properly sourced claims.
- Authoritativeness: external citations, recognition signals, brand mentions.
- Trustworthiness: HTTPS, contact info, privacy/terms, transparent ownership, accurate claims.

Word-count topical-coverage floors (FLOORS, not targets — Google has confirmed word count is NOT a direct ranking factor):
${Object.entries(PAGE_TYPE_MIN_WORDS).map(([k, v]) => `  - ${k}: ${v.min} words (${v.uniqueness} unique) — ${v.notes}`).join("\n")}

Also evaluate:
- Keyword usage: primary keyword in first 100 words; alignment between title, H1, URL; keyword cannibalization risk vs other pages on the same site.
- Heading hierarchy: one H1, logical H2/H3, descriptive (not styling-only).
- Content depth vs page-type floor; thin content (tag/category pages with no value, doorway pages).
- Internal linking density (3-5 per 1000 words); descriptive anchor text.
- External citations to authoritative sources.
- Freshness signals (publish/update dates visible in body sample).

AI-WRITING DETECTION (marketingskills/seo-audit ai-writing-detection.md). Flag if the body sample shows AI-tell clusters. The strongest signal is em-dash (—) overuse; >1 per page is suspicious. Other tells:
- Verbs to flag: ${AI_WRITING_TELLS.overusedVerbs.slice(0, 8).join(", ")}, …
- Adjectives to flag: ${AI_WRITING_TELLS.overusedAdjectives.slice(0, 8).join(", ")}, …
- Transitions/phrases to flag: ${AI_WRITING_TELLS.overusedTransitions.slice(0, 6).join(", ")}, …
- Signal phrases (red flags): ${AI_WRITING_TELLS.signalPhrases.slice(0, 4).join(" / ")}
- Filler intensifiers: ${AI_WRITING_TELLS.fillerIntensifiers.slice(0, 8).join(", ")}, …
If clustered, raise a Medium "AI-tell language" issue with 3-5 specific replacements drawn from the actual body sample.

Compute aiCitationReadiness (0-100) using the marketingskills/ai-seo extractability checklist: clear definition in first paragraph, self-contained answer blocks, statistics with sources, comparison tables for "vs" queries, FAQ section, expert attribution, recently updated (≤6 months), heading structure matches query patterns.

Produce a single content category score 0-100, findings (one per major check), and prioritized issues.`;

export async function runContent(parsed: ParsedPage): Promise<CategoryReport & { eeat: EeatBreakdown; aiCitationReadiness: number }> {
  return generateJson<CategoryReport & { eeat: EeatBreakdown; aiCitationReadiness: number }>({
    systemInstruction: `${CONTENT_PROMPT}\n\n${COMMON_RULES}`,
    schema: contentReportSchema,
    prompt: `${pageBrief(parsed)}\n\nProduce the content + E-E-A-T audit.`,
  });
}

// --- Schema (marketingskills/schema-markup) ---

const SCHEMA_PROMPT = `You are the schema-markup specialist (marketingskills/schema-markup).

Detect, validate, and recommend Schema.org JSON-LD markup.

Active types to recommend freely: Organization, LocalBusiness, SoftwareApplication, WebApplication, Product (with Certification markup as of April 2025), ProductGroup, Offer, Service, Article, BlogPosting, NewsArticle, Review, AggregateRating, BreadcrumbList, WebSite, WebPage, Person, ProfilePage, ContactPage, VideoObject, ImageObject, Event, JobPosting, Course, DiscussionForumPosting, BroadcastEvent, Clip, SeekToAction, SoftwareSourceCode.

Restricted: ${SCHEMA_RESTRICTED.map((s) => `${s.type} — ${s.rule}`).join("; ")}

Deprecated (NEVER recommend): ${SCHEMA_DEPRECATED.map((s) => `${s.type} (${s.since})`).join(", ")}.

For detected schema, validate required properties:
- Article/BlogPosting/NewsArticle require headline, author, datePublished, dateModified, image, publisher.
- Product requires name, image, description, offers (price + priceCurrency + availability) or aggregateRating.
- Organization requires name, url, logo (image), sameAs (social profiles).
- LocalBusiness requires name, address (PostalAddress), telephone, openingHoursSpecification.
- BreadcrumbList requires itemListElement with position + name + item.

Flag: placeholder text, relative URLs (must be absolute), invalid date formats, missing required props, dead schema (deprecated types still present).

For missing opportunities, generate ready-to-use JSON-LD snippets in "suggestions" — properly indented strings with absolute URLs and realistic placeholders matching the page.

Detection caveat: many sites inject JSON-LD via client-side JS (Yoast/RankMath/AIOSEO). If this page has zero JSON-LD AND a JS framework is detected, raise a "warn" finding ("schema may be JS-injected — verify with Rich Results Test") rather than a hard "fail".

Return: category score 0-100, findings, issues, "detected" array of @types found, "suggestions" array of JSON-LD code blocks.`;

export async function runSchema(
  parsed: ParsedPage,
): Promise<CategoryReport & { detected: string[]; suggestions: string[] }> {
  const schemaPreview = JSON.stringify(parsed.schema).slice(0, 3500);
  const jsHint = parsed.hasJsFramework
    ? `Note: JS framework detected (${parsed.jsFrameworks.join(", ")}). If schema appears absent, recommend Rich Results Test instead of declaring "no schema found".`
    : `No JS framework detected — static-HTML schema audit applies directly.`;
  return generateJson<CategoryReport & { detected: string[]; suggestions: string[] }>({
    systemInstruction: `${SCHEMA_PROMPT}\n\n${COMMON_RULES}`,
    schema: schemaReportSchema,
    prompt: `${pageBrief(parsed)}\n\n${jsHint}\n\nDetected JSON-LD raw (truncated):\n${schemaPreview}\n\nProduce the schema audit.`,
  });
}

// --- On-Page SEO (marketingskills/seo-audit "On-Page SEO Audit") ---

const ONPAGE_PROMPT = `You are the on-page SEO specialist (marketingskills/seo-audit "On-Page SEO Audit"). Walk these check categories:

TITLE TAGS
- Unique per page; primary keyword near beginning; ${TITLE_RULES.minChars}-${TITLE_RULES.maxChars} chars (visible in SERP); compelling and click-worthy; brand placement at end.
- Common issues: duplicate titles, too long (truncated), too short (wasted), keyword stuffing, missing entirely.

META DESCRIPTIONS
- Unique per page; ${META_DESC_RULES.minChars}-${META_DESC_RULES.maxChars} chars (ideal ${META_DESC_RULES.idealMin}-${META_DESC_RULES.idealMax}); includes primary keyword; clear value prop; CTA.
- Common issues: duplicate, auto-generated garbage, too long/short, no compelling reason to click.

HEADING STRUCTURE
- Exactly one H1 per page; H1 contains primary keyword; logical hierarchy (H1→H2→H3, no skipped levels); headings describe content (not just for styling).
- Common issues: multiple H1s, skip levels (H1→H3), no H1, headings used purely for visual styling.

CONTENT OPTIMIZATION
- Keyword in first 100 words; related keywords used naturally; sufficient depth for topic; answers search intent; better than competitors.
- Thin content: tag/category pages with no value, doorway pages, near-duplicate content.

IMAGE OPTIMIZATION (high-level only — full audit handled by image specialist)
- Descriptive filenames, alt text on every img, modern formats (WebP/AVIF), lazy loading, dimensions set.

INTERNAL LINKING
- Important pages well-linked, descriptive anchor text, no broken internal links, reasonable count per page.
- Common issues: orphan pages, over-optimized anchor text, important pages buried, excessive footer/sidebar links.

KEYWORD TARGETING
- Per-page: clear primary keyword target; title/H1/URL aligned; satisfies search intent; not cannibalizing other pages.
- Site-wide (judge from links sample): keyword mapping evident, no major coverage gaps, logical topical clusters.

Score on-page 0-100. Findings: one per check category above with pass/warn/fail. Issues: specific (cite the actual title length, the duplicate H1 text, the over-optimized anchor, etc.).`;

export async function runOnPage(parsed: ParsedPage): Promise<CategoryReport> {
  return generateJson<CategoryReport>({
    systemInstruction: `${ONPAGE_PROMPT}\n\n${COMMON_RULES}`,
    schema: categoryReportSchema,
    prompt: `${pageBrief(parsed)}\n\nProduce the on-page SEO audit.`,
  });
}

// --- Performance / CWV (marketingskills/seo-audit "Site Speed & Core Web Vitals") ---

const PERFORMANCE_PROMPT = `You are the performance / Core Web Vitals specialist (marketingskills/seo-audit "Site Speed & Core Web Vitals").

Targets (good thresholds): LCP ${CWV_THRESHOLDS.LCP.good}, INP ${CWV_THRESHOLDS.INP.good}, CLS ${CWV_THRESHOLDS.CLS.good}.

You CANNOT measure live field data from HTML alone. Infer RISK per metric from HTML signals:
- LCP risk: huge unoptimized hero images, render-blocking CSS/JS, missing fetchpriority="high" on the hero, late-loading hero, web-font swap not configured, no CDN signals.
- INP risk: heavy JS payload, SPA frameworks (React/Vue/Angular/Svelte) without SSR, many third-party scripts, scripts without defer/async.
- CLS risk: <img> without width/height, ads/embeds without reserved space, late-loading content, web fonts without font-display: swap.

Other speed factors to mention briefly (not measurable from HTML, recommend tools):
- Server response time / TTFB → recommend PageSpeed Insights and WebPageTest.
- Caching headers, CDN usage, font loading strategy.

Score performance 0-100 from inferred risk across LCP/INP/CLS. Findings should call out which CWV is at risk and why (status pass/warn/fail). Issues should be specific recommendations referencing the HTML signals you saw.

If a JS framework is detected and content appears to require client-side rendering, raise a Critical/High issue per the December 2025 Google JS SEO guidance.`;

export async function runPerformance(parsed: ParsedPage): Promise<CategoryReport> {
  return generateJson<CategoryReport>({
    systemInstruction: `${PERFORMANCE_PROMPT}\n\n${COMMON_RULES}`,
    schema: categoryReportSchema,
    prompt: `${pageBrief(parsed)}\n\nProduce the performance / CWV audit.`,
  });
}

// --- AI Search Readiness (marketingskills/ai-seo) ---

const GEO_PROMPT = `You are the AI search optimization specialist (marketingskills/ai-seo). Goal: get this page CITED by AI systems (Google AI Overviews, ChatGPT, Perplexity, Gemini, Copilot, Claude). Traditional SEO gets you ranked; AI SEO gets you cited.

Critical stats to keep in mind:
- AI Overviews appear in ~45% of Google searches and reduce clicks by up to 58%.
- Brands are 6.5x more likely to be cited via third-party sources than their own domain.
- Optimized content gets cited 3x more often than non-optimized.
- Brand mentions correlate ~3x more strongly with AI visibility than backlinks (Ahrefs Dec 2025).

Score across THREE PILLARS (roll up to 0-100):

PILLAR 1 — STRUCTURE (make content extractable). AI systems extract passages, not pages.
Block patterns to look for:
${AI_CONTENT_BLOCKS.map((b) => `  - ${b.block} (${b.trigger}): ${b.rule}`).join("\n")}
Structural rules: lead every section with a direct answer (don't bury it); keep key answer passages 40-60 words (optimal for snippet extraction); use H2/H3 that match how people phrase queries; tables beat prose for comparison; numbered lists beat paragraphs for process content; one idea per paragraph.

PILLAR 2 — AUTHORITY (make content citable).
Princeton GEO research (KDD 2024) ranking of optimization methods by visibility boost:
${GEO_OPTIMIZATION_METHODS.map((m) => `  - ${m.method}: ${m.visibilityBoost} — ${m.note}`).join("\n")}
Best combination: Fluency + Statistics. Low-ranking sites benefit even more — up to 115% visibility increase with citations. Keyword stuffing actively HURTS AI visibility (-10%).

PILLAR 3 — PRESENCE (be where AI looks).
Third-party sources matter MORE than your own site for AI visibility:
- Wikipedia mentions (~7.8% of all ChatGPT citations)
- Reddit discussions (~1.8% of ChatGPT citations; ~46.7% on Perplexity)
- Industry publications, guest posts, review sites (G2/Capterra/TrustRadius for B2B SaaS), YouTube, Quora.

Content types most cited in AI answers:
${AI_CITED_CONTENT_TYPES.map((c) => `  - ${c.type}: ${c.share}`).join("\n")}

AI BOT ACCESS — verify robots.txt does not block these (each block = lost citation channel):
GPTBot, ChatGPT-User, OAI-SearchBot (OpenAI/ChatGPT) | PerplexityBot (Perplexity) | ClaudeBot, anthropic-ai (Anthropic) | Google-Extended (Gemini + AI Overviews — note: blocking this does NOT affect Google Search) | Bingbot (Microsoft Copilot).

MACHINE-READABLE FILES for AI agents (recommend if missing):
${MACHINE_READABLE_FILES.map((f) => `  - ${f.path} — ${f.purpose}`).join("\n")}

PLATFORM-SPECIFIC NOTES (mention only when relevant to a finding):
${AI_PLATFORM_FACTORS.map((p) => `  - ${p.platform}${"appearsIn" in p && p.appearsIn ? ` (${p.appearsIn})` : ""}: ${p.selection}`).join("\n")}

If a JS framework is detected and the page appears to require client-side rendering, warn that AI crawlers do NOT execute JavaScript — content invisible to them.

Output: single AI Search Readiness score 0-100, findings mapped to the three pillars + bot access, issues. Be specific — cite the exact passage, the missing block pattern, the absent statistic.`;

export async function runGeo(args: {
  parsed: ParsedPage;
  robots: RobotsInfo;
}): Promise<CategoryReport> {
  const { parsed, robots } = args;
  const robotsSummary = robots.exists
    ? `robots.txt: AI crawlers blocked = [${robots.blocksAiCrawlers.join(", ") || "none"}]; sitemap entries = ${robots.sitemapUrls.length}`
    : `robots.txt missing at ${robots.url}`;
  return generateJson<CategoryReport>({
    systemInstruction: `${GEO_PROMPT}\n\n${COMMON_RULES}`,
    schema: categoryReportSchema,
    prompt: `${pageBrief(parsed)}\n\n${robotsSummary}\n\nProduce the AI Search Readiness audit.`,
  });
}

// --- Images (marketingskills/seo-audit "Image Optimization") ---

const IMAGES_PROMPT = `You are the image-SEO specialist (marketingskills/seo-audit "Image Optimization").

Per-image checks:
- Alt text: present (except role="presentation"), 10-125 chars, describes the image, not keyword-stuffed.
- File format: WebP/AVIF preferred over JPEG/PNG. Recommend <picture> with AVIF > WebP > JPEG fallback chain.
- CLS prevention: width/height attributes set on every <img>.
- Lazy loading: loading="lazy" on below-fold ONLY. Never lazy-load above-fold/LCP images. Recommend fetchpriority="high" on the LCP image.
- decoding="async" on non-LCP images.
- Filenames: descriptive, hyphenated, lowercase.
- Responsive images: srcset/sizes for content images.

For Google Images: alt text + filename + page context are CRITICAL ranking factors. IPTC Creator/Copyright is display-only (low SEO impact). EXIF camera data and IPTC keywords are ignored.

Produce a category score 0-100, findings (one per check category), and prioritized issues. Cite the specific image src when you raise an issue.`;

export async function runImages(parsed: ParsedPage): Promise<CategoryReport> {
  const summary = `Images: ${parsed.images.length}
Missing alt: ${parsed.images.filter((i) => !i.alt).length}
Missing dimensions: ${parsed.images.filter((i) => !i.width || !i.height).length}
With loading=lazy: ${parsed.images.filter((i) => i.loading === "lazy").length}
With fetchpriority=high: ${parsed.images.filter((i) => i.fetchpriority === "high").length}
With decoding=async: ${parsed.images.filter((i) => i.decoding === "async").length}
Sample: ${JSON.stringify(parsed.images.slice(0, 12))}`;
  return generateJson<CategoryReport>({
    systemInstruction: `${IMAGES_PROMPT}\n\n${COMMON_RULES}`,
    schema: categoryReportSchema,
    prompt: `${pageBrief(parsed)}\n\n${summary}\n\nProduce the image audit.`,
  });
}

// --- Site-type-specific issue list (used by orchestrator to enrich the executive summary) ---
export function siteTypeChecklist(industry: string): string[] {
  return SITE_TYPE_COMMON_ISSUES[industry] ?? [];
}

// --- International SEO (hreflang) — only runs when hreflang entries are present ---
export function hreflangBrief(parsed: ParsedPage): string {
  if (!parsed.hreflang.length) return "";
  return `Hreflang validation rules:\n${HREFLANG_RULES.map((r, i) => `  ${i + 1}. ${r}`).join("\n")}\n\nObserved hreflang entries (${parsed.hreflang.length}): ${JSON.stringify(parsed.hreflang)}\nCanonical: ${parsed.canonical ?? "(missing)"}\nPage URL: ${parsed.url}\n\nFlag: missing self-reference, missing x-default, invalid codes (e.g. en-UK should be en-GB), canonical not present in the hreflang set, protocol mismatch.`;
}

// --- Site Architecture (marketingskills/site-architecture) ---

const ARCHITECTURE_PROMPT = `You are the site-architecture specialist (marketingskills/site-architecture). Your job is to (a) infer the site's information architecture from the homepage HTML signals, (b) audit it against marketingskills rules, and (c) propose a corrected hierarchy.

Site-type starting points (typical depth + key sections + URL pattern):
${Object.entries(SITE_TYPE_DEPTH).map(([k, v]) => `  - ${k}: ${v.typicalDepth} | ${v.keySections.join(" / ")} | ${v.urlPattern}`).join("\n")}

HIERARCHY RULES
- 3-Click Rule: every important page reachable within 3 clicks from the homepage. Critical pages 4+ levels deep = problem.
- Flat (2 levels): small sites/portfolios. Moderate (3 levels): most SaaS/content sites. Deep (4+ levels): e-commerce, large docs.
- Rule of thumb: go as flat as possible while keeping nav clean. Nav dropdown with 20+ items → add a level of hierarchy.
- Levels: L0 Homepage (/), L1 Primary section (/features), L2 Section page (/features/analytics), L3+ Detail (/docs/api/auth).

NAVIGATION RULES
- Header nav: ${NAV_RULES.headerMinItems}-${NAV_RULES.headerMaxItems} items max (more = decision paralysis).
- ${NAV_RULES.ctaPlacement}.
- Logo links to homepage (left side).
- Order header by priority (most important/visited pages first).
- Mega menu: limit to 3-4 columns.
- Footer columns: ${NAV_RULES.footerColumns.join(" / ")}.
- Breadcrumbs: must mirror URL hierarchy. Every segment clickable except current page.

URL DESIGN PRINCIPLES
${URL_DESIGN_PRINCIPLES.map((p) => `  - ${p}`).join("\n")}

URL PATTERNS BY PAGE TYPE
${URL_PATTERNS_BY_PAGE_TYPE.map((p) => `  - ${p.pageType}: ${p.pattern} → ${p.example}`).join("\n")}

URL COMMON MISTAKES (flag if observed in the link sample)
${URL_COMMON_MISTAKES.map((m) => `  - ${m}`).join("\n")}

INTERNAL LINKING
- No orphan pages — every page must have at least one inbound internal link.
- Descriptive anchor text (not "click here" / "read more").
- ${NAV_RULES.internalLinksPer1000Words} internal links per 1000 words of content (guideline).
- Hub-and-spoke: pillar page links to all spokes; spokes link back to hub; spokes link to each other where relevant.

WHAT TO INFER FROM THE PARSED HTML
- Header items: derive from the link sample's high-frequency hostname-internal links visible early in the page (likely nav).
- Footer items: derive from internal links typically clustered at low frequency.
- Breadcrumbs: presence inferred from BreadcrumbList JSON-LD or repeated short anchor sequences.
- URL hygiene: scan the link sample for the URL common mistakes above.

OUTPUT REQUIREMENTS (this is structured JSON — match the schema exactly)
- detectedHierarchy: nested ArchitectureNode tree (level 0 = homepage). Cap at 3 levels deep, ≤8 children per node.
- asciiTree: a string using ├──/└── exactly like the marketingskills format. Wrap at 80 cols.
- mermaid: a "graph TD" string with subgraphs for "Header Nav" and "Footer Nav" where helpful. Use short node IDs.
- urlMap: 8-15 rows covering the most important pages with priority High/Medium/Low.
- navigation.header: items observed (or recommended), ctaLabel if visible (else null), itemCount, itemsWithinRule (true if 4-7).
- navigation.footer.columns: group inferred footer links into the four canonical columns; omit a column if there's no signal.
- navigation.breadcrumbs: present (boolean), mirrorsUrl (boolean), notes (one sentence).
- internalLinking.hubs: 1-3 hub-and-spoke clusters worth pursuing for this site.
- internalLinking.orphanRisks: pages that look like they'd lack internal links.
- internalLinking.crossSectionOpportunities: e.g. "Feature page → related case study".
- linksPer1000WordsObserved: estimate as a string ratio (e.g. "~6/1000").
- urlAudit: findings (one per URL design principle that's pass/warn/fail) and concrete issues with specific URLs from the sample.
- issues: top architecture-level issues (3-click violations, header overload, missing breadcrumbs, etc.).
- overallScore 0-100: weight equally hierarchy depth, nav rules, URL hygiene, internal linking.
- summary: 2-3 sentences calling out the biggest structural finding and the recommended fix.`;

export async function runSiteArchitecture(args: {
  parsed: ParsedPage;
}): Promise<Omit<ArchitectureReport, "url" | "command" | "industry">> {
  const { parsed } = args;
  const linkSample = JSON.stringify(parsed.links.sample).slice(0, 2500);
  return generateJson<Omit<ArchitectureReport, "url" | "command" | "industry">>({
    systemInstruction: `${ARCHITECTURE_PROMPT}\n\n${COMMON_RULES}`,
    schema: architectureReportSchema,
    prompt: `${pageBrief(parsed)}\n\nLink sample (up to 30 internal/external links):\n${linkSample}\n\nProduce the site architecture analysis.`,
  });
}

// --- Programmatic SEO (marketingskills/programmatic-seo) ---

const PROGRAMMATIC_PROMPT = `You are the programmatic-SEO specialist (marketingskills/programmatic-seo). Goal: design a programmatic page system for THIS site that ranks, provides genuine value per page, and avoids thin-content penalties.

CORE PRINCIPLES (apply all):
${PROGRAMMATIC_CORE_PRINCIPLES.map((p, i) => `  ${i + 1}. ${p}`).join("\n")}

DATA DEFENSIBILITY HIERARCHY (recommend higher tiers; flag if relying on tier 5):
${DATA_DEFENSIBILITY_HIERARCHY.map((d) => `  Tier ${d.tier}: ${d.source} — ${d.note}`).join("\n")}

THE 12 PLAYBOOKS — pick the BEST fit for this site, plus 2-3 alternatives:
${PROGRAMMATIC_PLAYBOOKS.map((p) => `  - ${p.name}: pattern "${p.pattern}" → e.g. ${p.example}\n      Why it works: ${p.why}\n      URL structure: ${p.urlStructure}\n      Value requirements: ${p.valueRequirements.join("; ")}`).join("\n")}

PLAYBOOK SELECTION HEURISTIC (assets → playbook):
- Proprietary data → Directories, Profiles, Stats
- Product with integrations → Integrations
- Design/creative product → Templates, Examples
- Multi-segment audience → Personas
- Local presence → Locations
- Tool or utility product → Conversions
- Content/expertise → Glossary, Curation
- International potential → Translations
- Competitor landscape → Comparisons
Combine playbooks where natural (e.g. Locations + Personas, Curation + Locations).

COMMON MISTAKES TO ACTIVELY GUARD AGAINST:
${PROGRAMMATIC_COMMON_MISTAKES.map((m) => `  - ${m}`).join("\n")}

PRE-LAUNCH CHECKLIST (you must score each item pass/warn/fail in qualityChecklist):
${PROGRAMMATIC_PRELAUNCH_CHECKLIST.map((c) => `  - ${c}`).join("\n")}

OUTPUT REQUIREMENTS (structured JSON — match schema exactly):
- recommendedPlaybook: pick ONE from [${PROGRAMMATIC_PLAYBOOKS.map((p) => p.name).join(", ")}], based on what you can infer about the site from the homepage.
- alternativePlaybooks: 2-3 backups with one-sentence rationale each.
- patternAnalysis.keywordPattern: the literal repeating pattern (e.g. "best [category] in [city]").
- patternAnalysis.variables: each variable in the pattern with one example value and a sourceTier (1=proprietary..5=public).
- patternAnalysis.estimatedUniqueCombinations: order-of-magnitude estimate as a string (e.g. "~5,000" or "200-500").
- patternAnalysis.searchIntentSummary: one sentence describing the dominant intent (informational / commercial / transactional / navigational).
- pageTemplate.urlPattern: must use subfolder hierarchy with {variable} placeholders, hyphens, lowercase.
- pageTemplate.titleTemplate: 50-60 char target with {variable} placeholders; primary keyword near beginning.
- pageTemplate.metaDescriptionTemplate: 150-160 chars with {variable} placeholders.
- pageTemplate.h1Template: matches title intent.
- pageTemplate.sections: 4-7 named sections; each declares its uniquenessSource (which variable or data point makes THIS page different from sibling pages).
- pageTemplate.schemaJsonLd: ready-to-use JSON-LD string (NEVER recommend HowTo or new FAQPage on commercial sites; never recommend deprecated types).
- pageTemplate.sampleRenderedPage: a fully-substituted concrete example so the user can see the output.
- internalLinkingPlan: hub page (typically /{playbook-folder}/), spoke linking pattern, 3-5 cross-link rules (e.g. "spokes link to 3 sibling spokes by shared variable Y").
- indexationStrategy: separate sitemap per page type, noindex criteria for thin variants, crawl-budget notes.
- dataRequirements: proprietary data needed (the moat), public data acceptable as fallback, refresh cadence.
- thinContentRiskScore (0-100): higher = more risk that pages will be flagged thin. Penalize patterns relying purely on tier-5 public data with little uniqueSource per section.
- qualityChecklist: every item from the pre-launch checklist above with status pass/warn/fail and a one-line detail noting what's needed for THIS site to pass.
- estimatedPageCount: realistic (with quality bar enforced) and aspirational (max addressable) plus rationale.
- issues: top 3-7 risks specific to this site/playbook combo, with priority/effort.
- summary: 2-3 sentences, lead with the recommended playbook + the unique-value-per-page lever.

If the user has supplied a preferred playbook, treat it as a strong hint but override only if it would clearly fail the unique-value-per-page principle (and explain why in the summary).`;

export async function runProgrammatic(args: {
  parsed: ParsedPage;
  preferredPlaybook?: ProgrammaticPlaybook;
}): Promise<Omit<ProgrammaticReport, "url" | "command" | "industry">> {
  const { parsed, preferredPlaybook } = args;
  const linkSample = JSON.stringify(parsed.links.sample).slice(0, 2500);
  const playbookHint = preferredPlaybook
    ? `\n\nUser preference: the user has indicated playbook "${preferredPlaybook}" as their starting hypothesis. Validate or override.`
    : `\n\nNo user playbook preference — recommend the best fit from scratch.`;
  return generateJson<Omit<ProgrammaticReport, "url" | "command" | "industry">>({
    systemInstruction: `${PROGRAMMATIC_PROMPT}\n\n${COMMON_RULES}`,
    schema: programmaticReportSchema,
    prompt: `${pageBrief(parsed)}\n\nLink sample (signals nav/IA):\n${linkSample}${playbookHint}\n\nProduce the programmatic SEO design.`,
  });
}

// --- Single-page deep analysis (marketingskills/seo-audit applied to a single URL) ---

const PAGE_PROMPT = `You are the single-page SEO auditor (marketingskills/seo-audit, applied to one URL). Produce a deep analysis covering five pillars:

ON-PAGE SEO
  - Title ${TITLE_RULES.minChars}-${TITLE_RULES.maxChars} chars; meta ${META_DESC_RULES.minChars}-${META_DESC_RULES.maxChars} chars; one H1; H2-H6 hierarchy; URL quality; internal/external links.

CONTENT QUALITY
  - Word count vs page-type minimum; readability; keyword in first 100 words; E-E-A-T signals; freshness signals visible.
  - AI-tells flag: em-dash overuse, AI-signal phrases (see common rules).

TECHNICAL
  - Canonical present and correct; meta robots; OG; Twitter Card; hreflang validation if international (self-reference, x-default, valid ISO codes, canonical in the hreflang set, no cross-locale canonical).

SCHEMA
  - Detect all types; validate required props; flag deprecated types (NEVER recommend HowTo or new FAQPage on commercial sites). Provide ready-to-use JSON-LD strings for missing opportunities.

IMAGES
  - Alt text; size flags >200KB warning, >500KB critical; format WebP/AVIF; dimensions for CLS; loading=lazy below-fold only; fetchpriority="high" on LCP.

CWV REFERENCES (risk only — not measurable from HTML alone): LCP, INP, CLS thresholds.

Score each pillar 0-100. Prioritize issues Critical > High > Medium > Low. Each issue must include a specific Fix referencing values from this page.`;

export async function runPageDeep(parsed: ParsedPage): Promise<{
  summary: string;
  scores: { onPage: number; content: number; technical: number; schema: number; images: number };
  issues: { priority: "Critical" | "High" | "Medium" | "Low"; category: string; title: string; description: string; recommendation: string; effort?: "low" | "medium" | "high" }[];
  schemaSuggestions: string[];
}> {
  const intl = hreflangBrief(parsed);
  return generateJson({
    systemInstruction: `${PAGE_PROMPT}\n\n${COMMON_RULES}`,
    schema: pageReportSchema,
    prompt: `${pageBrief(parsed)}${intl ? `\n\n${intl}` : ""}\n\nProduce the deep single-page analysis.`,
  });
}
