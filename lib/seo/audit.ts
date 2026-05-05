// Audit orchestrator. Mirrors skills/seo-audit/SKILL.md "Process":
//   1. Fetch homepage
//   2. Detect business type
//   3. Delegate to subagents in parallel
//   5. Score (SEO Health Score with the SKILL.md weights)
//   6. Generate prioritized action plan

import {
  detectIndustry,
  runContent,
  runGeo,
  runImages,
  runOnPage,
  runPerformance,
  runProgrammatic,
  runSchema,
  runSiteArchitecture,
  runTechnical,
  siteTypeChecklist,
} from "./agents";
import { fetchAndParse, fetchRobots, fetchSitemap } from "./parse-html";
import { HEALTH_SCORE_WEIGHTS, type HealthCategory, type ProgrammaticPlaybook } from "./references";
import type { ArchitectureReport, AuditReport, CategoryScores, Issue, PageReport, ProgrammaticReport, Priority } from "./types";
import { runPageDeep } from "./agents";

function clamp(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function computeOverallScore(scores: CategoryScores): number {
  let total = 0;
  for (const [k, w] of Object.entries(HEALTH_SCORE_WEIGHTS)) {
    total += (scores[k as HealthCategory] ?? 0) * w;
  }
  return clamp(total);
}

const PRIORITY_ORDER: Priority[] = ["Critical", "High", "Medium", "Low"];

function buildActionPlan(issues: Issue[]): { priority: Priority; items: Issue[] }[] {
  return PRIORITY_ORDER.map((p) => ({
    priority: p,
    items: issues.filter((i) => i.priority === p),
  }));
}

export async function runAudit(url: string): Promise<AuditReport> {
  const parsed = await fetchAndParse(url);
  const [robots] = await Promise.all([fetchRobots(url)]);
  const sitemap = await fetchSitemap(url, robots);

  // Industry detection runs first because some SKILL.md sub-skills are
  // industry-conditional in the upstream orchestrator. Here we use it to
  // contextualize prompts (and surface to the user).
  const industry = await detectIndustry(parsed);

  // Parallel subagent delegation (skills/seo-audit/SKILL.md step 4).
  // allSettled so a single agent failing (rate limit, malformed JSON, timeout)
  // degrades that one category to a placeholder instead of nuking the whole
  // audit. We log the rejection reason so it surfaces in Vercel function logs.
  const settled = await Promise.allSettled([
    runTechnical({ parsed, robots, sitemap }),
    runContent(parsed),
    runSchema(parsed),
    runOnPage(parsed),
    runPerformance(parsed),
    runGeo({ parsed, robots }),
    runImages(parsed),
  ]);
  const labels = ["technical", "content", "schema", "onPage", "performance", "aiSearch", "images"] as const;
  const placeholder = (label: string) => ({
    score: 0,
    status: "warn" as const,
    summary: `${label} agent failed to complete. Re-run the audit if this persists.`,
    findings: [],
    issues: [],
  });
  const contentPlaceholder = () => ({
    ...placeholder("content"),
    eeat: {
      Experience: { score: 0, signals: [] },
      Expertise: { score: 0, signals: [] },
      Authoritativeness: { score: 0, signals: [] },
      Trustworthiness: { score: 0, signals: [] },
    },
    aiCitationReadiness: 0,
  });
  const schemaPlaceholder = () => ({
    ...placeholder("schema"),
    detected: [],
    suggestions: [],
  });
  const unwrap = <T,>(idx: number, fallback: T): T => {
    const r = settled[idx];
    if (r.status === "fulfilled") return r.value as T;
    console.error(`[audit] ${labels[idx]} agent failed:`, r.reason);
    return fallback;
  };
  const technical = unwrap(0, placeholder("technical"));
  const content = unwrap(1, contentPlaceholder());
  const schema = unwrap(2, schemaPlaceholder());
  const onPage = unwrap(3, placeholder("onPage"));
  const performance = unwrap(4, placeholder("performance"));
  const aiSearch = unwrap(5, placeholder("aiSearch"));
  const images = unwrap(6, placeholder("images"));

  const scores: CategoryScores = {
    technical: clamp(technical.score),
    content: clamp(content.score),
    onPage: clamp(onPage.score),
    schema: clamp(schema.score),
    performance: clamp(performance.score),
    aiSearchReadiness: clamp(aiSearch.score),
    images: clamp(images.score),
  };

  const overallScore = computeOverallScore(scores);

  const allIssues: Issue[] = [
    ...technical.issues,
    ...content.issues,
    ...schema.issues,
    ...onPage.issues,
    ...performance.issues,
    ...aiSearch.issues,
    ...images.issues,
  ];

  const sortedCritical = allIssues.filter((i) => i.priority === "Critical").slice(0, 5);
  const quickWins = allIssues
    .filter((i) => (i.effort === "low" || !i.effort) && (i.priority === "High" || i.priority === "Medium"))
    .slice(0, 5);

  const siteChecklist = siteTypeChecklist(industry.industry);
  const executiveSummary = [
    `Detected industry: ${industry.industry} (${industry.confidence} confidence; page type: ${industry.pageType}).`,
    `SEO Health Score: ${overallScore}/100.`,
    `Critical issues found: ${allIssues.filter((i) => i.priority === "Critical").length}.`,
    siteChecklist.length
      ? `Site-type watch list (${industry.industry}): ${siteChecklist.slice(0, 3).join("; ")}.`
      : "",
  ].filter(Boolean).join(" ");

  return {
    url,
    command: "audit",
    industry,
    overallScore,
    scores,
    executiveSummary,
    topCriticalIssues: sortedCritical,
    topQuickWins: quickWins,
    categories: {
      technical,
      content,
      onPage,
      schema,
      performance,
      aiSearchReadiness: aiSearch,
      images,
    },
    actionPlan: buildActionPlan(allIssues),
  };
}

// --- Single-page wrapper (skills/seo-page/SKILL.md) ---

export async function runPage(url: string): Promise<PageReport> {
  const parsed = await fetchAndParse(url);
  const industry = await detectIndustry(parsed);
  const deep = await runPageDeep(parsed);

  // seo-page uses its own 5-pillar scoring (no AI/Performance separation).
  // Roll up to overall via simple average of the 5 pillars per the SKILL.md
  // score card; we don't apply the 7-category Health weights here because
  // /seo page is a single-page deep dive, not a full audit.
  const scoreVals = [deep.scores.onPage, deep.scores.content, deep.scores.technical, deep.scores.schema, deep.scores.images];
  const overallScore = clamp(scoreVals.reduce((a, b) => a + b, 0) / scoreVals.length);

  return {
    url,
    command: "page",
    industry,
    overallScore,
    scores: {
      onPage: clamp(deep.scores.onPage),
      content: clamp(deep.scores.content),
      technical: clamp(deep.scores.technical),
      schema: clamp(deep.scores.schema),
      images: clamp(deep.scores.images),
    },
    scoreCard: [
      { label: "On-Page SEO", score: clamp(deep.scores.onPage) },
      { label: "Content Quality", score: clamp(deep.scores.content) },
      { label: "Technical", score: clamp(deep.scores.technical) },
      { label: "Schema", score: clamp(deep.scores.schema) },
      { label: "Images", score: clamp(deep.scores.images) },
    ],
    summary: deep.summary,
    issues: deep.issues,
    schemaSuggestions: deep.schemaSuggestions,
  };
}

// --- Programmatic SEO wrapper (marketingskills/programmatic-seo) ---

export async function runProgrammaticSeo(
  url: string,
  preferredPlaybook?: ProgrammaticPlaybook,
): Promise<ProgrammaticReport> {
  const parsed = await fetchAndParse(url);
  const industry = await detectIndustry(parsed);
  const result = await runProgrammatic({ parsed, preferredPlaybook });

  return {
    url,
    command: "programmatic",
    industry,
    recommendedPlaybook: result.recommendedPlaybook,
    alternativePlaybooks: result.alternativePlaybooks,
    patternAnalysis: result.patternAnalysis,
    pageTemplate: result.pageTemplate,
    internalLinkingPlan: result.internalLinkingPlan,
    indexationStrategy: result.indexationStrategy,
    dataRequirements: result.dataRequirements,
    thinContentRiskScore: clamp(result.thinContentRiskScore),
    qualityChecklist: result.qualityChecklist,
    estimatedPageCount: result.estimatedPageCount,
    issues: result.issues,
    summary: result.summary,
  };
}

// --- Site architecture wrapper (marketingskills/site-architecture) ---

export async function runArchitecture(url: string): Promise<ArchitectureReport> {
  const parsed = await fetchAndParse(url);
  const industry = await detectIndustry(parsed);
  const result = await runSiteArchitecture({ parsed });

  return {
    url,
    command: "architecture",
    industry,
    overallScore: clamp(result.overallScore),
    summary: result.summary,
    detectedHierarchy: result.detectedHierarchy,
    asciiTree: result.asciiTree,
    mermaid: result.mermaid,
    urlMap: result.urlMap,
    navigation: result.navigation,
    internalLinking: result.internalLinking,
    urlAudit: result.urlAudit,
    issues: result.issues,
  };
}
