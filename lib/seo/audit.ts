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
import { withStepContext } from "./glm";
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

// Lifecycle event emitted by runAudit so the API can stream per-agent
// progress back to the UI. `index` is 1-based across the full step list
// (Fetch + Industry + the 7 category agents = 9 steps).
//
// Lifecycle: queued → running → done|failed.
//   queued  — wrapper started, agent is waiting on the GLM semaphore
//   running — semaphore acquired, request to z.ai is in flight
//   done    — agent returned successfully
//   failed  — agent threw (already retried internally)
export type AuditEvent =
  | { type: "start"; total: number; steps: { index: number; label: string }[] }
  | { type: "step"; index: number; label: string; status: "queued" }
  | { type: "step"; index: number; label: string; status: "running" }
  | { type: "step"; index: number; label: string; status: "done"; durationMs: number }
  | { type: "step"; index: number; label: string; status: "failed"; error: string; durationMs: number };

const AUDIT_STEPS = [
  "Fetch page · robots · sitemap",
  "Industry detection",
  "Technical SEO",
  "Content quality + E-E-A-T",
  "Schema / structured data",
  "On-page SEO",
  "Performance / Core Web Vitals",
  "AI search readiness (GEO)",
  "Images",
] as const;

async function trackStep<T>(
  index: number,
  label: string,
  emit: ((e: AuditEvent) => void) | undefined,
  fn: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; reason: unknown }> {
  emit?.({ type: "step", index, label, status: "queued" });
  let startedAt = Date.now();
  try {
    const value = await withStepContext(
      () => {
        startedAt = Date.now();
        emit?.({ type: "step", index, label, status: "running" });
      },
      fn,
    );
    emit?.({ type: "step", index, label, status: "done", durationMs: Date.now() - startedAt });
    return { ok: true, value };
  } catch (reason) {
    const error = reason instanceof Error ? reason.message : String(reason);
    emit?.({ type: "step", index, label, status: "failed", error, durationMs: Date.now() - startedAt });
    return { ok: false, reason };
  }
}

export async function runAudit(
  url: string,
  emit?: (event: AuditEvent) => void,
): Promise<AuditReport> {
  emit?.({
    type: "start",
    total: AUDIT_STEPS.length,
    steps: AUDIT_STEPS.map((label, i) => ({ index: i + 1, label })),
  });

  const fetchStep = await trackStep(1, AUDIT_STEPS[0], emit, async () => {
    const parsed = await fetchAndParse(url);
    const [robots] = await Promise.all([fetchRobots(url)]);
    const sitemap = await fetchSitemap(url, robots);
    return { parsed, robots, sitemap };
  });
  if (!fetchStep.ok) throw fetchStep.reason;
  const { parsed, robots, sitemap } = fetchStep.value;

  // Industry detection runs first because some SKILL.md sub-skills are
  // industry-conditional in the upstream orchestrator. Here we use it to
  // contextualize prompts (and surface to the user).
  const industryStep = await trackStep(2, AUDIT_STEPS[1], emit, () => detectIndustry(parsed));
  if (!industryStep.ok) throw industryStep.reason;
  const industry = industryStep.value;

  // Parallel subagent delegation, gated by the GLM client's concurrency
  // semaphore. trackStep emits "queued" immediately, then "running" only
  // when the inner chat() call actually acquires the semaphore — so the UI
  // animates step-by-step even though all 7 wrappers start together. This
  // keeps wall-clock under the 300s Vercel hobby cap (sequential blew past
  // it on heavy pages) while preserving the one-at-a-time visual cadence.
  type StepResult<T> = { ok: true; value: T } | { ok: false; reason: unknown };
  const settled = (await Promise.allSettled([
    trackStep(3, AUDIT_STEPS[2], emit, () => runTechnical({ parsed, robots, sitemap })),
    trackStep(4, AUDIT_STEPS[3], emit, () => runContent(parsed)),
    trackStep(5, AUDIT_STEPS[4], emit, () => runSchema(parsed)),
    trackStep(6, AUDIT_STEPS[5], emit, () => runOnPage(parsed)),
    trackStep(7, AUDIT_STEPS[6], emit, () => runPerformance(parsed)),
    trackStep(8, AUDIT_STEPS[7], emit, () => runGeo({ parsed, robots })),
    trackStep(9, AUDIT_STEPS[8], emit, () => runImages(parsed)),
  ])).map((r): StepResult<unknown> =>
    r.status === "fulfilled"
      ? r.value
      : { ok: false, reason: r.reason },
  );
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
    if (r.ok) return r.value as T;
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

const PAGE_STEPS = ["Fetch page", "Industry detection", "Deep page analysis"] as const;

export async function runPage(
  url: string,
  emit?: (event: AuditEvent) => void,
): Promise<PageReport> {
  emit?.({ type: "start", total: PAGE_STEPS.length, steps: PAGE_STEPS.map((label, i) => ({ index: i + 1, label })) });

  const fetchStep = await trackStep(1, PAGE_STEPS[0], emit, () => fetchAndParse(url));
  if (!fetchStep.ok) throw fetchStep.reason;
  const parsed = fetchStep.value;

  const industryStep = await trackStep(2, PAGE_STEPS[1], emit, () => detectIndustry(parsed));
  if (!industryStep.ok) throw industryStep.reason;
  const industry = industryStep.value;

  const deepStep = await trackStep(3, PAGE_STEPS[2], emit, () => runPageDeep(parsed));
  if (!deepStep.ok) throw deepStep.reason;
  const deep = deepStep.value;

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

const PROGRAMMATIC_STEPS = ["Fetch page", "Industry detection", "Programmatic playbook"] as const;

export async function runProgrammaticSeo(
  url: string,
  preferredPlaybook?: ProgrammaticPlaybook,
  emit?: (event: AuditEvent) => void,
): Promise<ProgrammaticReport> {
  emit?.({ type: "start", total: PROGRAMMATIC_STEPS.length, steps: PROGRAMMATIC_STEPS.map((label, i) => ({ index: i + 1, label })) });

  const fetchStep = await trackStep(1, PROGRAMMATIC_STEPS[0], emit, () => fetchAndParse(url));
  if (!fetchStep.ok) throw fetchStep.reason;
  const parsed = fetchStep.value;

  const industryStep = await trackStep(2, PROGRAMMATIC_STEPS[1], emit, () => detectIndustry(parsed));
  if (!industryStep.ok) throw industryStep.reason;
  const industry = industryStep.value;

  const playbookStep = await trackStep(3, PROGRAMMATIC_STEPS[2], emit, () => runProgrammatic({ parsed, preferredPlaybook }));
  if (!playbookStep.ok) throw playbookStep.reason;
  const result = playbookStep.value;

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

const ARCHITECTURE_STEPS = ["Fetch page", "Industry detection", "Site architecture"] as const;

export async function runArchitecture(
  url: string,
  emit?: (event: AuditEvent) => void,
): Promise<ArchitectureReport> {
  emit?.({ type: "start", total: ARCHITECTURE_STEPS.length, steps: ARCHITECTURE_STEPS.map((label, i) => ({ index: i + 1, label })) });

  const fetchStep = await trackStep(1, ARCHITECTURE_STEPS[0], emit, () => fetchAndParse(url));
  if (!fetchStep.ok) throw fetchStep.reason;
  const parsed = fetchStep.value;

  const industryStep = await trackStep(2, ARCHITECTURE_STEPS[1], emit, () => detectIndustry(parsed));
  if (!industryStep.ok) throw industryStep.reason;
  const industry = industryStep.value;

  const archStep = await trackStep(3, ARCHITECTURE_STEPS[2], emit, () => runSiteArchitecture({ parsed }));
  if (!archStep.ok) throw archStep.reason;
  const result = archStep.value;

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
