import Link from "next/link";
import { getSession } from "@/lib/auth/server";

const SKILLS: {
  id: string;
  command: string;
  name: string;
  blurb: string;
  bullets: string[];
  output: string;
}[] = [
  {
    id: "audit",
    command: "/seo audit",
    name: "Full Site Audit",
    blurb:
      "Seven specialist AI agents run in parallel and walk the priority funnel — Crawlability → Technical → On-Page → Content → Authority — then roll the results up into a single SEO Health Score. The audit fetches the page, robots.txt, and sitemap on its own; you only need a URL.",
    bullets: [
      "Technical (crawlability, indexation, security, mobile, CWV risk, JS rendering, AI crawler mgmt)",
      "Content + E-E-A-T with machine-written-content tell detection (em-dash overuse, signal phrases, fillers)",
      "On-page (title 50-60, meta 150-160, headings, anchor text, keyword cannibalization)",
      "Schema (validation, JS-injection caveat, ready-to-paste JSON-LD)",
      "Performance / Core Web Vitals risk inferred from HTML signals",
      "AI Search (3 pillars: Structure / Authority / Presence; citation research data)",
      "Images (alt, dimensions, lazy/fetchpriority, format)",
      "Hreflang validation when international entries exist",
      "Site-type-specific common-issues lists (SaaS / E-com / Publisher / Local / Multilingual)",
    ],
    output:
      "Health Score 0-100, weighted breakdown, top critical issues, top quick wins, prioritized action plan, schema suggestions.",
  },
  {
    id: "page",
    command: "/seo page",
    name: "Single-Page Deep Dive",
    blurb:
      "Five-pillar deep analysis applied to one URL. Use this when you want a thorough breakdown of a single landing page or blog post without running the whole-site funnel.",
    bullets: [
      "On-page SEO (title 50-60 chars, meta 150-160, one H1, hierarchy, URL quality)",
      "Content quality (page-type word floors, keyword in first 100 words, freshness, AI-tell scan)",
      "Technical (canonical, meta robots, OG, Twitter, hreflang validation)",
      "Schema (deprecated-type guard, ready-to-paste JSON-LD)",
      "Images (alt, KB warning bands, modern formats)",
    ],
    output:
      "Per-pillar scores 0-100, prioritized issues with specific fixes, JSON-LD suggestions.",
  },
  {
    id: "architecture",
    command: "/seo architecture",
    name: "Site Architecture",
    blurb:
      "Information-architecture audit: infers the site's hierarchy from homepage signals, validates it against a navigation/URL ruleset, then proposes a corrected structure with an ASCII tree, Mermaid sitemap, and URL map table.",
    bullets: [
      "3-Click Rule check (every important page reachable in ≤3 clicks)",
      "Header nav: 4-7 items, CTA placement, logo position",
      "Footer columns (Product / Resources / Company / Legal)",
      "Breadcrumb presence + URL-mirror check",
      "URL design principles (hyphens, lowercase, no dates, no IDs)",
      "Hub-and-spoke linking clusters with orphan-page risks",
      "Cross-section link opportunities",
    ],
    output:
      "Architecture score 0-100, ASCII tree, Mermaid graph TD, URL map table, navigation spec, internal-linking plan.",
  },
  {
    id: "programmatic",
    command: "/seo programmatic",
    name: "Programmatic SEO",
    blurb:
      "Designs a programmatic page system at scale. The agent picks one of 12 playbooks (or follows your hint), generates URL/title/meta/H1 templates with {variable} placeholders, and scores thin-content risk against a data defensibility hierarchy.",
    bullets: [
      "12 playbooks: Templates / Curation / Conversions / Comparisons / Examples / Locations / Personas / Integrations / Glossary / Translations / Directory / Profiles",
      "Data defensibility hierarchy (proprietary > product-derived > UGC > licensed > public)",
      "URL/title/meta/H1 templates + sample fully-rendered page",
      "Section table with 'uniqueness source' per section (the moat)",
      "JSON-LD schema for the page type",
      "Hub-and-spoke internal-linking plan",
      "Indexation strategy (sitemap split, noindex criteria, crawl budget)",
      "Pre-launch checklist (11 items)",
    ],
    output:
      "Quality score, recommended playbook + alternatives, page template, sample render, thin-content risk score, estimated page count (realistic vs aspirational).",
  },
  {
    id: "rewrite",
    command: "/seo rewrite",
    name: "Capture & Rewrite",
    blurb:
      "Capture a live page (HTML + inlined CSS + screenshots via Playwright), then prompt-rewrite specific sections with AI. The workspace also exposes a research-driven generator: paste competitor URLs + a keyword and the pipeline scrapes, chunks, embeds, runs cosine top-k theme search, and generates a grounded outline or full article that can be piped into the rewrite prompt. Captures never expire.",
    bullets: [
      "Playwright headful capture · CSS inlined · screenshots before/after",
      "Section-level prompted rewrites with @section1 targeting",
      "Indefinite storage — captures never expire",
      "Research drawer: scrape + chunk (1000/200) + vector embed + cosine top-k",
      "Generates outline (markdown) or full article (400-3000 words)",
      "Cite-by-number prompt to keep claims grounded in sources",
      "One-click 'Use in rewrite prompt' to apply research to the page",
    ],
    output:
      "Editable workspace at /rewrite-content/{id} with the captured page, a rewrite prompt dock, and a Research drawer that emits research metrics, themes, and grounded markdown.",
  },
];

export default async function ManualPage() {
  const session = await getSession();
  if (!session) return null;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-10 px-4 py-10 sm:gap-12 sm:px-6 sm:py-12 lg:gap-16 lg:px-12">
      {/* Header */}
      <section className="grid grid-cols-1 gap-y-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <span className="swiss-eyebrow text-muted">— Reference</span>
          <h1 className="mt-3 text-balance text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Manual.
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-sm leading-relaxed text-muted sm:mt-6 sm:text-base">
            What each skill does, what it returns, and how it's scored. All
            five skills are AI-powered and structured-output validated, so the
            JSON shape of every report is stable and machine-readable.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-end sm:gap-3 lg:col-span-5">
          <Link
            href="/history"
            className="border border-hairline px-5 py-2.5 text-center text-sm font-medium hover:border-foreground"
          >
            View history →
          </Link>
          <Link
            href="/"
            className="bg-foreground px-5 py-2.5 text-center text-sm font-medium text-background transition-opacity hover:opacity-85"
          >
            Run a skill →
          </Link>
        </div>
      </section>

      {/* Skills */}
      <section>
        <div className="flex items-baseline justify-between border-b border-hairline pb-3">
          <span className="swiss-eyebrow text-muted">— 01 / Skills</span>
          <span className="text-xs text-muted swiss-num">{SKILLS.length} total</span>
        </div>
        <div className="mt-0 divide-y divide-hairline border-b border-hairline">
          {SKILLS.map((s, i) => (
            <article
              key={s.id}
              className="grid grid-cols-1 gap-x-6 gap-y-4 py-6 sm:py-8 lg:grid-cols-12"
            >
              <div className="lg:col-span-4">
                <span className="swiss-eyebrow text-muted swiss-num">
                  {String(i + 1).padStart(2, "0")} / {s.command}
                </span>
                <h2 className="mt-2 text-2xl font-medium tracking-tight sm:text-3xl">{s.name}</h2>
              </div>
              <div className="lg:col-span-8">
                <p className="text-sm leading-relaxed">{s.blurb}</p>
                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {s.bullets.map((b) => (
                    <div key={b} className="flex items-start gap-2 text-xs text-muted">
                      <span className="mt-1 h-1 w-1 shrink-0 bg-foreground" />
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 border-t border-hairline pt-3">
                  <span className="swiss-eyebrow text-muted">Output</span>
                  <p className="mt-1 text-xs">{s.output}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Methodology */}
      <section>
        <span className="swiss-eyebrow text-muted">— 02 / Health Score Weights</span>
        <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-xs swiss-num sm:grid-cols-4 lg:grid-cols-7">
          {[
            ["22%", "TECHNICAL"],
            ["23%", "CONTENT"],
            ["20%", "ON-PAGE"],
            ["10%", "SCHEMA"],
            ["10%", "PERFORMANCE"],
            ["10%", "AI SEARCH"],
            ["05%", "IMAGES"],
          ].map(([w, label]) => (
            <li key={label} className="flex flex-col gap-1 border-t border-hairline pt-2">
              <span className="text-2xl font-medium tabular-nums">{w}</span>
              <span className="swiss-eyebrow text-muted">{label}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 max-w-2xl text-xs text-muted">
          The full audit walks a priority funnel
          (Crawlability → Technical → On-Page → Content → Authority) and rolls
          the seven category scores into a single SEO Health Score using these
          weights.
        </p>
      </section>
    </div>
  );
}
