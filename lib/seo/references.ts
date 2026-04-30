// Reference data ported from coreyhaines31/marketingskills:
// - skills/seo-audit/SKILL.md
// - skills/seo-audit/references/ai-writing-detection.md
// - skills/seo-audit/references/international-seo.md
// - skills/ai-seo/SKILL.md (Princeton GEO research, content patterns, platform factors)
// - skills/schema-markup/SKILL.md
// Also retains Schema.org v29.4 deprecation/restriction lists.

// Manager-internal rollup weights. marketingskills/seo-audit specifies a priority FUNNEL
// (Crawlability → Technical → On-Page → Content → Authority) but no numerical weights for
// rolling 7 category scores into one overall score. We use this weighted average so
// the dashboard can show one number; treat as a UI convenience, not a marketingskills rule.
export const HEALTH_SCORE_WEIGHTS = {
  technical: 0.22,
  content: 0.23,
  onPage: 0.2,
  schema: 0.1,
  performance: 0.1,
  aiSearchReadiness: 0.1,
  images: 0.05,
} as const;

export type HealthCategory = keyof typeof HEALTH_SCORE_WEIGHTS;

// marketingskills/seo-audit "Priority Order" suggests Critical → High → Medium → Low buckets
// for the action plan. The time-window descriptions ("fix within 1 week" etc.) are
// Manager-internal working definitions; not a marketingskills mandate.
export const PRIORITY_DEFINITIONS = {
  Critical: "Blocks indexing or causes penalties (fix immediately)",
  High: "Significantly impacts rankings (fix within 1 week)",
  Medium: "Optimization opportunity (fix within 1 month)",
  Low: "Nice to have (backlog)",
} as const;

// marketingskills/seo-audit "Priority Order" — audit walks the funnel top-down.
export const AUDIT_PRIORITY_ORDER = [
  "Crawlability & Indexation",
  "Technical Foundations",
  "On-Page Optimization",
  "Content Quality",
  "Authority & Links",
] as const;

export const CWV_THRESHOLDS = {
  LCP: { good: "<=2.5s", needsImprovement: "2.5-4.0s", poor: ">4.0s" },
  INP: { good: "<=200ms", needsImprovement: "200-500ms", poor: ">500ms" },
  CLS: { good: "<=0.1", needsImprovement: "0.1-0.25", poor: ">0.25" },
} as const;

// Schema deprecation list (Feb 2026, Schema.org v29.4). marketingskills/schema-markup
// recommends a positive list of Common Schema Types but does not maintain a deprecation
// list with dates. The hard rule about HowTo (no rich results since Sept 2023) and
// FAQPage restrictions IS in marketingskills/seo-audit; the rest of this list is curated
// from Google's official rich-results changelog. Update as Google retires types.
export const SCHEMA_DEPRECATED = [
  { type: "HowTo", since: "Sept 2023", reason: "Rich results fully removed" },
  { type: "SpecialAnnouncement", since: "July 2025", reason: "COVID-era schema, no longer processed" },
  { type: "CourseInfo", since: "June 2025", reason: "Retired from rich results; merged into Course" },
  { type: "EstimatedSalary", since: "June 2025", reason: "Retired from rich results" },
  { type: "LearningVideo", since: "June 2025", reason: "Retired; use VideoObject instead" },
  { type: "ClaimReview", since: "June 2025", reason: "Fact-check markup no longer generates rich results" },
  { type: "VehicleListing", since: "June 2025", reason: "Retired from rich results" },
  { type: "Practice Problem", since: "Late 2025", reason: "Retired from rich results" },
  { type: "Dataset", since: "Late 2025", reason: "Dataset Search discontinued" },
];

export const SCHEMA_RESTRICTED = [
  {
    type: "FAQPage",
    rule: "Google rich results only for government/healthcare sites (Aug 2023). Existing FAQPage on commercial sites: flag at Info priority (not Critical), notes AI/LLM citation upside. New FAQPage: not recommended for Google benefit; acceptable if AI visibility is a priority.",
  },
];

// Industry detection signals (marketingskills/seo-audit "Common Issues by Site Type" — keep in sync).
export const INDUSTRY_SIGNALS = {
  SaaS: ["pricing page", "/features", "/integrations", "/docs", "free trial", "sign up"],
  "Local Service": ["phone number", "address", "service area", "serving [city]", "Google Maps embed"],
  "E-commerce": ["/products", "/collections", "/cart", "add to cart", "product schema"],
  Publisher: ["/blog", "/articles", "/topics", "article schema", "author pages", "publication dates"],
  Agency: ["/case-studies", "/portfolio", "/industries", "our work", "client logos"],
} as const;

// Site-type-specific common issues (marketingskills/seo-audit "Common Issues by Site Type")
export const SITE_TYPE_COMMON_ISSUES: Record<string, string[]> = {
  SaaS: [
    "Product pages lack content depth",
    "Blog not integrated with product pages",
    "Missing comparison/alternative pages",
    "Feature pages thin on content",
    "No glossary/educational content",
  ],
  "E-commerce": [
    "Thin category pages",
    "Duplicate product descriptions",
    "Missing product schema",
    "Faceted navigation creating duplicates",
    "Out-of-stock pages mishandled",
  ],
  Publisher: [
    "Outdated content not refreshed",
    "Keyword cannibalization",
    "No topical clustering",
    "Poor internal linking",
    "Missing author pages",
  ],
  "Local Service": [
    "Inconsistent NAP (name/address/phone)",
    "Missing LocalBusiness schema",
    "No Google Business Profile optimization",
    "Missing location pages",
    "No local content",
  ],
  Multilingual: [
    "Hreflang errors (missing return tags, invalid codes, no self-reference)",
    "Canonical conflicting with hreflang (cross-locale canonical suppresses indexing)",
    "Thin locale pages dragging down site-wide quality signal",
    "Only boilerplate translated, main content identical across locales",
    "No x-default fallback declared",
    "Sitemap missing hreflang alternates",
    "IP-based redirects hiding content from Googlebot",
  ],
};

// marketingskills/seo-audit explicitly notes "word count is NOT a direct ranking factor"
// but recommends "sufficient depth/length for topic". These specific minimums are
// Manager-internal floors used as prompt context — they help Gemini judge "thin content"
// without being prescriptive. Consider these heuristics, not marketingskills mandates.
export const PAGE_TYPE_MIN_WORDS: Record<string, { min: number; uniqueness: string; notes: string }> = {
  Homepage: { min: 500, uniqueness: "100%", notes: "Must clearly communicate value proposition" },
  "Service Page": { min: 800, uniqueness: "100%", notes: "Detailed explanation of offering" },
  "Blog Post": { min: 1500, uniqueness: "100%", notes: "In-depth, valuable content" },
  "Product Page": { min: 400, uniqueness: "80%+", notes: "Unique descriptions, specs" },
  "Category Page": { min: 400, uniqueness: "100%", notes: "Unique intro, not just product listings" },
  "Location Page (Primary)": { min: 600, uniqueness: "60%+", notes: "City HQ or main service area" },
  "Location Page (Secondary)": { min: 500, uniqueness: "40%+", notes: "Satellite locations" },
  "About Page": { min: 400, uniqueness: "100%", notes: "Company story, team, values" },
  "Landing Page": { min: 600, uniqueness: "100%", notes: "Focused conversion content" },
  "FAQ Page": { min: 800, uniqueness: "100%", notes: "Comprehensive Q&A" },
};

// marketingskills/seo-audit "Content Quality Assessment" describes E-E-A-T qualitatively
// and emphasizes "Trust = most important". These specific weights (Trust=30, Exp/Auth=25,
// Experience=20) are Manager-internal — used to prompt Gemini to score each pillar.
// Adjust if you want to lean more heavily on a different pillar.
export const EEAT_WEIGHTS = {
  Experience: 0.2,
  Expertise: 0.25,
  Authoritativeness: 0.25,
  Trustworthiness: 0.3,
} as const;

// marketingskills/seo-audit: Title 50-60 chars, Meta description 150-160 chars.
export const TITLE_RULES = { minChars: 50, maxChars: 60 };
export const META_DESC_RULES = { minChars: 150, maxChars: 160, idealMin: 150, idealMax: 160 };

// marketingskills/seo-audit "Image Optimization" lists qualitative checks (compressed
// file sizes, modern formats, lazy loading) but doesn't give numeric KB thresholds.
// These thresholds are Manager-internal heuristics passed to Gemini as warning bands.
export const IMAGE_SIZE_THRESHOLDS = {
  Thumbnails: { target: "<50KB", warning: ">100KB", critical: ">200KB" },
  ContentImages: { target: "<100KB", warning: ">200KB", critical: ">500KB" },
  HeroBanner: { target: "<200KB", warning: ">300KB", critical: ">700KB" },
};

// AI crawlers — marketingskills/ai-seo "AI Bot Access Check"
export const AI_CRAWLERS = [
  { token: "GPTBot", company: "OpenAI", purpose: "ChatGPT training" },
  { token: "OAI-SearchBot", company: "OpenAI", purpose: "OpenAI search features" },
  { token: "ChatGPT-User", company: "OpenAI", purpose: "ChatGPT browsing" },
  { token: "ClaudeBot", company: "Anthropic", purpose: "Claude features/training" },
  { token: "anthropic-ai", company: "Anthropic", purpose: "Anthropic crawler (legacy)" },
  { token: "PerplexityBot", company: "Perplexity", purpose: "Perplexity AI search" },
  { token: "Google-Extended", company: "Google", purpose: "Gemini training & AI Overviews (NOT search)" },
  { token: "CCBot", company: "Common Crawl", purpose: "Open dataset (training only)" },
  { token: "Bytespider", company: "ByteDance", purpose: "Model training" },
];

// --- Princeton GEO research (KDD 2024, marketingskills/ai-seo "Pillar 2: Authority") ---
// Visibility boost from method when applied to content already in the candidate set.
export const GEO_OPTIMIZATION_METHODS = [
  { method: "Cite sources", visibilityBoost: "+40%", note: "Add authoritative references with links" },
  { method: "Add statistics", visibilityBoost: "+37%", note: "Specific numbers with sources and dates" },
  { method: "Add quotations", visibilityBoost: "+30%", note: "Expert quotes with name and title" },
  { method: "Authoritative tone", visibilityBoost: "+25%", note: "Write with demonstrated expertise" },
  { method: "Improve clarity", visibilityBoost: "+20%", note: "Simplify complex concepts" },
  { method: "Technical terms", visibilityBoost: "+18%", note: "Use domain-specific terminology" },
  { method: "Unique vocabulary", visibilityBoost: "+15%", note: "Increase word diversity" },
  { method: "Fluency optimization", visibilityBoost: "+15-30%", note: "Improve readability and flow" },
  { method: "Keyword stuffing", visibilityBoost: "-10%", note: "ACTIVELY HURTS AI visibility" },
] as const;

// AI search platform notes (marketingskills/ai-seo "How AI Search Works")
export const AI_PLATFORM_FACTORS = [
  { platform: "Google AI Overviews", appearsIn: "~45% of searches", selection: "Strong correlation with traditional rankings; cites top-10 ~92%" },
  { platform: "ChatGPT (search)", selection: "Wider than top-rank; Wikipedia 7.8%, Reddit 1.8%" },
  { platform: "Perplexity", selection: "Always cites; favors authoritative + recent + structured; Reddit ~46.7%" },
  { platform: "Gemini", selection: "Pulls from Google index + Knowledge Graph" },
  { platform: "Copilot", selection: "Bing index + authoritative sources" },
  { platform: "Claude", selection: "Brave Search (when enabled) + training data" },
] as const;

// AI-extractable content block patterns (marketingskills/ai-seo "Pillar 1: Structure")
export const AI_CONTENT_BLOCKS = [
  { block: "Definition block", trigger: "What is X?", rule: "First paragraph: 'X is …' in 40-60 words" },
  { block: "Step-by-step block", trigger: "How to X", rule: "Numbered list, one action per step" },
  { block: "Comparison table", trigger: "X vs Y", rule: "Tables beat prose; 4-8 rows, balanced criteria" },
  { block: "Pros/cons block", trigger: "evaluation queries", rule: "Two parallel lists with specific items" },
  { block: "FAQ block", trigger: "common questions", rule: "Question-shaped H3s + 40-60 word answers" },
  { block: "Statistic block", trigger: "data queries", rule: "Number + source + date inline (e.g. '3x — Ahrefs, Dec 2025')" },
] as const;

// Hreflang validation rules (marketingskills/seo-audit "International SEO")
export const HREFLANG_RULES = [
  "Self-referencing entry on every page (page must include itself in the hreflang set)",
  "Reciprocal links (if A→B, B must link back; otherwise pair dropped)",
  "Valid codes: ISO 639-1 lang + optional ISO 3166-1 Alpha 2 region (en, en-GB — never en-UK)",
  "x-default present, pointing to fallback page",
  "All target URLs return 200, are indexable, match their canonical URL",
  "Canonical must self-canonical per locale (never cross-locale)",
  "Canonical URL must appear in the hreflang set (else hreflang ignored)",
  "Protocol/domain consistent across canonical, hreflang, sitemap",
];

// AI writing tells — marketingskills/seo-audit/references/ai-writing-detection.md
export const AI_WRITING_TELLS = {
  emDashOveruse: "Em dash (—) is the primary AI tell. >1 per page is suspicious. Replace with commas, colons, or parentheses.",
  overusedVerbs: ["delve into", "leverage", "utilise", "facilitate", "foster", "bolster", "underscore", "unveil", "navigate", "streamline", "enhance", "endeavour", "ascertain", "elucidate"],
  overusedAdjectives: ["robust", "comprehensive", "pivotal", "crucial", "vital", "transformative", "cutting-edge", "groundbreaking", "innovative", "seamless", "intricate", "nuanced", "multifaceted", "holistic"],
  overusedTransitions: ["furthermore", "moreover", "notwithstanding", "that being said", "at its core", "to put it simply", "it is worth noting that", "in the realm of", "in the landscape of", "in today's"],
  signalPhrases: [
    "In today's fast-paced world",
    "In today's digital age",
    "In an era of",
    "In the ever-evolving landscape of",
    "Let's delve into",
    "It's important to note that",
    "Whether you're a [X], [Y], or [Z]",
    "It's not just [X], it's also [Y]",
    "By [doing X], you can [achieve Y]",
  ],
  fillerIntensifiers: ["absolutely", "actually", "basically", "certainly", "clearly", "definitely", "essentially", "extremely", "fundamentally", "incredibly", "really", "significantly", "simply", "ultimately", "undoubtedly", "very"],
  academicTells: ["shed light on", "pave the way for", "a myriad of", "a plethora of", "paramount", "pertaining to", "prior to", "subsequent to", "in light of", "with respect to", "in terms of"],
} as const;

// Most-cited content types in AI answers (marketingskills/ai-seo)
export const AI_CITED_CONTENT_TYPES = [
  { type: "Comparison articles", share: "~33%" },
  { type: "Definitive guides", share: "~15%" },
  { type: "Original research/data", share: "~12%" },
  { type: "Best-of/listicles", share: "~10%" },
  { type: "Product pages", share: "~10%" },
  { type: "Opinion/analysis", share: "~10%" },
  { type: "How-to guides", share: "~8%" },
] as const;

// Machine-readable AI agent files (marketingskills/ai-seo "Machine-Readable Files for AI Agents")
export const MACHINE_READABLE_FILES = [
  { path: "/llms.txt", purpose: "AI context overview (llmstxt.org)" },
  { path: "/pricing.md or /pricing.txt", purpose: "Structured pricing data — AI agents skip products with opaque pricing" },
  { path: "/AGENTS.md", purpose: "Agent capabilities" },
  { path: "/robots.txt", purpose: "Crawler directives (must not block AI search bots if you want citation)" },
];

// --- Site architecture (marketingskills/site-architecture) ---

export const SITE_TYPE_DEPTH: Record<string, { typicalDepth: string; keySections: string[]; urlPattern: string }> = {
  SaaS: { typicalDepth: "2-3 levels", keySections: ["Home", "Features", "Pricing", "Blog", "Docs"], urlPattern: "/features/{name}, /blog/{slug}" },
  Publisher: { typicalDepth: "2-3 levels", keySections: ["Home", "Blog", "Categories", "About"], urlPattern: "/blog/{slug}, /category/{slug}" },
  "E-commerce": { typicalDepth: "3-4 levels", keySections: ["Home", "Categories", "Products", "Cart"], urlPattern: "/category/subcategory/product" },
  Documentation: { typicalDepth: "3-4 levels", keySections: ["Home", "Guides", "API Reference"], urlPattern: "/docs/{section}/{page}" },
  Agency: { typicalDepth: "2-3 levels", keySections: ["Home", "Work", "Services", "About", "Contact"], urlPattern: "/work/{slug}, /services/{name}" },
  "Local Service": { typicalDepth: "1-2 levels", keySections: ["Home", "Services", "About", "Contact"], urlPattern: "/services/{name}" },
  Other: { typicalDepth: "2-3 levels", keySections: ["Home", "About", "Contact"], urlPattern: "/{slug}" },
};

export const URL_PATTERNS_BY_PAGE_TYPE = [
  { pageType: "Homepage", pattern: "/", example: "example.com" },
  { pageType: "Feature page", pattern: "/features/{name}", example: "/features/analytics" },
  { pageType: "Pricing", pattern: "/pricing", example: "/pricing" },
  { pageType: "Blog post", pattern: "/blog/{slug}", example: "/blog/seo-guide" },
  { pageType: "Blog category", pattern: "/blog/category/{slug}", example: "/blog/category/seo" },
  { pageType: "Case study", pattern: "/customers/{slug}", example: "/customers/acme-corp" },
  { pageType: "Documentation", pattern: "/docs/{section}/{page}", example: "/docs/api/authentication" },
  { pageType: "Legal", pattern: "/{page}", example: "/privacy, /terms" },
  { pageType: "Landing page", pattern: "/{slug} or /lp/{slug}", example: "/free-trial, /lp/webinar" },
  { pageType: "Comparison", pattern: "/compare/{competitor} or /vs/{competitor}", example: "/compare/competitor-name" },
  { pageType: "Integration", pattern: "/integrations/{name}", example: "/integrations/slack" },
  { pageType: "Template", pattern: "/templates/{slug}", example: "/templates/marketing-plan" },
] as const;

export const URL_DESIGN_PRINCIPLES = [
  "Readable by humans — /features/analytics not /f/a123",
  "Hyphens, not underscores — /blog/seo-guide not /blog/seo_guide",
  "URL path should match site structure (reflect the hierarchy)",
  "Consistent trailing-slash policy — pick one and enforce it",
  "Lowercase always — /About should redirect to /about",
  "Short but descriptive (3-5 segments max in the path)",
];

export const URL_COMMON_MISTAKES = [
  "Dates in blog URLs (/blog/2024/01/15/post-title) — use /blog/post-title",
  "Over-nesting (/products/category/subcategory/item/detail) — flatten",
  "Changing URLs without 301 redirects — loses backlink equity",
  "IDs in URLs (/product/12345) — use slugs",
  "Query parameters for content (/blog?id=123) — use /blog/post-title",
  "Inconsistent parent paths — don't mix /features/analytics and /product/automation",
];

export const NAV_RULES = {
  headerMaxItems: 7,
  headerMinItems: 4,
  threeClickRule: "Users should reach any important page within 3 clicks from the homepage",
  ctaPlacement: "CTA button rightmost (e.g. 'Start Free Trial')",
  footerColumns: ["Product", "Resources", "Company", "Legal"],
  internalLinksPer1000Words: "5-10",
};

// --- Programmatic SEO (marketingskills/programmatic-seo) ---

export type ProgrammaticPlaybook =
  | "Templates"
  | "Curation"
  | "Conversions"
  | "Comparisons"
  | "Examples"
  | "Locations"
  | "Personas"
  | "Integrations"
  | "Glossary"
  | "Translations"
  | "Directory"
  | "Profiles";

export const PROGRAMMATIC_PLAYBOOKS: {
  name: ProgrammaticPlaybook;
  pattern: string;
  example: string;
  why: string;
  valueRequirements: string[];
  urlStructure: string;
}[] = [
  {
    name: "Templates",
    pattern: "[Type] template",
    example: "resume template, invoice template, pitch deck template",
    why: "High intent — people need it now; shareable/linkable assets; natural for product-led companies",
    valueRequirements: ["Actually usable templates (not just previews)", "Multiple variations per type", "Quality comparable to paid options", "Easy download/use flow"],
    urlStructure: "/templates/{type}/ or /templates/{category}/{type}/",
  },
  {
    name: "Curation",
    pattern: "best [category] / top [number] [things]",
    example: "best website builders, top 10 crm software",
    why: "Comparison shoppers; high commercial intent; evergreen with updates",
    valueRequirements: ["Genuine evaluation criteria", "Real testing or expertise", "Regular updates with date visible", "Not just affiliate-driven rankings"],
    urlStructure: "/best/{category}/ or /{category}/best/",
  },
  {
    name: "Conversions",
    pattern: "[X] to [Y] / [amount] [unit] in [unit]",
    example: "$10 USD to GBP, 100 kg to lbs, pdf to word",
    why: "Instant utility; extremely high search volume; repeat-usage potential",
    valueRequirements: ["Accurate, real-time data", "Fast, functional tool", "Related conversions suggested", "Mobile-friendly interface"],
    urlStructure: "/convert/{from}-to-{to}/ or /{from}-to-{to}-converter/",
  },
  {
    name: "Comparisons",
    pattern: "[X] vs [Y] / [X] alternative",
    example: "webflow vs wordpress, notion vs coda, figma alternatives",
    why: "High purchase intent; clear search pattern; scales with number of competitors",
    valueRequirements: ["Honest, balanced analysis", "Actual feature comparison data", "Clear recommendation by use case", "Updated when products change"],
    urlStructure: "/compare/{x}-vs-{y}/ or /{x}-vs-{y}/",
  },
  {
    name: "Examples",
    pattern: "[type] examples / [category] inspiration",
    example: "saas landing page examples, email subject line examples",
    why: "Research-phase traffic; highly shareable; natural for design/creative tools",
    valueRequirements: ["Real, high-quality examples", "Screenshots or embeds", "Categorization/filtering", "Analysis of why they work"],
    urlStructure: "/examples/{type}/ or /{type}-examples/",
  },
  {
    name: "Locations",
    pattern: "[service/thing] in [location]",
    example: "coworking spaces in san diego, dentists in austin",
    why: "Local intent is massive; scales with geography; natural for marketplaces/directories",
    valueRequirements: ["Actual local data (not just city name swapped)", "Local providers/options listed", "Location-specific insights (pricing, regulations)", "Map integration helpful"],
    urlStructure: "/{service}/{city}/ or /locations/{city}/{service}/",
  },
  {
    name: "Personas",
    pattern: "[product] for [audience] / [solution] for [role/industry]",
    example: "payroll software for agencies, crm for real estate",
    why: "Speaks directly to searcher's context; higher conversion than generic; scales with personas",
    valueRequirements: ["Genuine persona-specific content", "Relevant features highlighted", "Testimonials from that segment", "Use cases specific to audience"],
    urlStructure: "/for/{persona}/ or /solutions/{industry}/",
  },
  {
    name: "Integrations",
    pattern: "[your product] [other product] integration",
    example: "slack asana integration, zapier airtable",
    why: "Captures users of other products; high intent; scales with integration ecosystem",
    valueRequirements: ["Real integration details", "Setup instructions", "Use cases for the combination", "Working integration (not vaporware)"],
    urlStructure: "/integrations/{product}/ or /connect/{product}/",
  },
  {
    name: "Glossary",
    pattern: "what is [term] / [term] definition / [term] meaning",
    example: "what is pSEO, api definition, what does crm stand for",
    why: "Top-of-funnel awareness; establishes expertise; natural internal-linking opportunities",
    valueRequirements: ["Clear, accurate definitions", "Examples and context", "Related terms linked", "More depth than a dictionary"],
    urlStructure: "/glossary/{term}/ or /learn/{term}/",
  },
  {
    name: "Translations",
    pattern: "Same content in multiple languages",
    example: "qué es pSEO, was ist SEO, マーケティングとは",
    why: "Opens entirely new markets; lower competition in many languages; multiplies content reach",
    valueRequirements: ["Quality translation (not just Google Translate)", "Cultural localization", "hreflang tags properly implemented", "Native-speaker review"],
    urlStructure: "/{lang}/{page}/",
  },
  {
    name: "Directory",
    pattern: "[category] tools / [type] software / [category] companies",
    example: "ai copywriting tools, email marketing software",
    why: "Research-phase capture; link-building magnet; natural for aggregators/reviewers",
    valueRequirements: ["Comprehensive coverage", "Useful filtering/sorting", "Details per listing (not just names)", "Regular updates"],
    urlStructure: "/directory/{category}/ or /{category}-directory/",
  },
  {
    name: "Profiles",
    pattern: "[person/company name] / [entity] + [attribute]",
    example: "stripe ceo, airbnb founding story",
    why: "Informational-intent traffic; builds topical authority; natural for B2B, news, research",
    valueRequirements: ["Accurate, sourced information", "Regularly updated", "Unique insights or aggregation", "Not just Wikipedia rehash"],
    urlStructure: "/people/{name}/ or /companies/{name}/",
  },
];

export const DATA_DEFENSIBILITY_HIERARCHY = [
  { tier: 1, source: "Proprietary", note: "You created it" },
  { tier: 2, source: "Product-derived", note: "From your users" },
  { tier: 3, source: "User-generated", note: "Your community" },
  { tier: 4, source: "Licensed", note: "Exclusive access" },
  { tier: 5, source: "Public", note: "Anyone can use — weakest defensibility" },
] as const;

export const PROGRAMMATIC_CORE_PRINCIPLES = [
  "Unique Value Per Page — every page must provide value specific to that page (not just swapped variables)",
  "Proprietary Data Wins — proprietary > product-derived > user-generated > licensed > public",
  "Clean URL Structure — use subfolders, not subdomains (subfolders consolidate domain authority)",
  "Genuine Search Intent Match — pages must actually answer what people are searching for",
  "Quality Over Quantity — 100 great pages beat 10,000 thin ones",
  "Avoid Google Penalties — no doorway pages, no keyword stuffing, no duplicate content, genuine utility for users",
];

export const PROGRAMMATIC_COMMON_MISTAKES = [
  "Thin content — just swapping city names in identical content",
  "Keyword cannibalization — multiple pages targeting the same keyword",
  "Over-generation — creating pages with no search demand",
  "Poor data quality — outdated or incorrect information",
  "Ignoring UX — pages exist for Google, not users",
];

export const PROGRAMMATIC_PRELAUNCH_CHECKLIST = [
  "Each page provides unique value",
  "Answers search intent",
  "Readable and useful",
  "Unique titles and meta descriptions",
  "Proper heading structure",
  "Schema markup implemented",
  "Page speed acceptable",
  "Connected to site architecture (no orphan pages)",
  "Related pages linked (hub-and-spoke)",
  "In XML sitemap",
  "Crawlable, no conflicting noindex",
];
