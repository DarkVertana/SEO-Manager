import type { HealthCategory } from "./references";

export type Priority = "Critical" | "High" | "Medium" | "Low";
export type Industry = "SaaS" | "Local Service" | "E-commerce" | "Publisher" | "Agency" | "Other";
export type Command =
  | "page"
  | "audit"
  | "architecture"
  | "programmatic"
  | "technical"
  | "content"
  | "schema"
  | "images"
  | "geo"
  | "sitemap";

export type Issue = {
  priority: Priority;
  category: string;
  title: string;
  description: string;
  recommendation: string;
  effort?: "low" | "medium" | "high";
};

export type CategoryStatus = "pass" | "warn" | "fail";

export type ParsedPage = {
  url: string;
  status: number;
  title: string | null;
  metaDescription: string | null;
  metaRobots: string | null;
  canonical: string | null;
  lang: string | null;
  viewport: string | null;
  charset: string | null;
  contentType: string | null;
  isHttps: boolean;
  h1: string[];
  h2: string[];
  h3: string[];
  images: {
    src: string;
    alt: string | null;
    width: string | null;
    height: string | null;
    loading: string | null;
    fetchpriority: string | null;
    decoding: string | null;
  }[];
  links: {
    internal: number;
    external: number;
    nofollow: number;
    sample: { href: string; text: string }[];
  };
  schema: unknown[];
  schemaTypes: string[];
  openGraph: Record<string, string>;
  twitterCard: Record<string, string>;
  hreflang: { lang: string; href: string | null }[];
  wordCount: number;
  hasJsFramework: boolean;
  jsFrameworks: string[];
  bodyTextSample: string;
};

export type RobotsInfo = {
  exists: boolean;
  url: string;
  status: number | null;
  body: string | null;
  allowsCommonCrawlers: boolean;
  blocksAiCrawlers: string[];
  sitemapUrls: string[];
};

export type SitemapInfo = {
  exists: boolean;
  url: string | null;
  status: number | null;
  urlCount: number | null;
  preview: string[];
  isIndex: boolean;
};

export type CategoryReport = {
  score: number; // 0-100
  status: CategoryStatus;
  summary: string;
  findings: { label: string; status: CategoryStatus; detail?: string }[];
  issues: Issue[];
};

export type EeatBreakdown = {
  Experience: { score: number; signals: string[] };
  Expertise: { score: number; signals: string[] };
  Authoritativeness: { score: number; signals: string[] };
  Trustworthiness: { score: number; signals: string[] };
};

export type IndustryDetection = {
  industry: Industry;
  confidence: "high" | "medium" | "low";
  signals: string[];
  pageType: string;
};

export type CategoryScores = Record<HealthCategory, number>;

export type AuditReport = {
  url: string;
  command: Command;
  industry: IndustryDetection;
  overallScore: number;
  scores: CategoryScores;
  executiveSummary: string;
  topCriticalIssues: Issue[];
  topQuickWins: Issue[];
  categories: {
    technical: CategoryReport;
    content: CategoryReport & { eeat: EeatBreakdown; aiCitationReadiness: number };
    onPage: CategoryReport;
    schema: CategoryReport & { detected: string[]; suggestions: string[] };
    performance: CategoryReport;
    aiSearchReadiness: CategoryReport;
    images: CategoryReport;
  };
  actionPlan: { priority: Priority; items: Issue[] }[];
};

export type PageReport = {
  url: string;
  command: "page";
  industry: IndustryDetection;
  overallScore: number;
  scores: { onPage: number; content: number; technical: number; schema: number; images: number };
  scoreCard: { label: string; score: number }[];
  summary: string;
  issues: Issue[];
  schemaSuggestions: string[];
};

export type ArchitectureNode = {
  label: string;
  url: string;
  level: number;
  navZone: "header" | "footer" | "sidebar" | "contextual" | "orphan";
  children?: ArchitectureNode[];
};

// --- Programmatic SEO ---

export type ProgrammaticReport = {
  url: string;
  command: "programmatic";
  industry: IndustryDetection;
  recommendedPlaybook: string;
  alternativePlaybooks: { name: string; rationale: string }[];
  patternAnalysis: {
    keywordPattern: string;
    variables: { name: string; example: string; sourceTier: 1 | 2 | 3 | 4 | 5 }[];
    estimatedUniqueCombinations: string;
    searchIntentSummary: string;
  };
  pageTemplate: {
    urlPattern: string;
    titleTemplate: string;
    metaDescriptionTemplate: string;
    h1Template: string;
    sections: { heading: string; purpose: string; uniquenessSource: string }[];
    schemaJsonLd: string;
    sampleRenderedPage: { url: string; title: string; metaDescription: string; h1: string };
  };
  internalLinkingPlan: {
    hubPage: string;
    spokePattern: string;
    crossLinkRules: string[];
  };
  indexationStrategy: {
    sitemapStrategy: string;
    noindexCriteria: string;
    crawlBudgetNotes: string;
  };
  dataRequirements: {
    proprietaryDataNeeded: string[];
    publicDataAcceptable: string[];
    refreshCadence: string;
  };
  thinContentRiskScore: number;
  qualityChecklist: { check: string; status: CategoryStatus; detail?: string }[];
  estimatedPageCount: { realistic: number; aspirational: number; rationale: string };
  issues: Issue[];
  summary: string;
};

export type ArchitectureReport = {
  url: string;
  command: "architecture";
  industry: IndustryDetection;
  overallScore: number;
  summary: string;
  detectedHierarchy: ArchitectureNode[];
  asciiTree: string;
  mermaid: string;
  urlMap: { page: string; url: string; parent: string; navLocation: string; priority: "High" | "Medium" | "Low" }[];
  navigation: {
    header: { items: string[]; ctaLabel: string | null; itemCount: number; itemsWithinRule: boolean };
    footer: { columns: { title: string; links: string[] }[] };
    breadcrumbs: { present: boolean; mirrorsUrl: boolean; notes: string };
  };
  internalLinking: {
    hubs: { hub: string; spokes: string[] }[];
    orphanRisks: string[];
    crossSectionOpportunities: string[];
    linksPer1000WordsObserved: string;
  };
  urlAudit: {
    findings: { label: string; status: CategoryStatus; detail?: string }[];
    issues: Issue[];
  };
  issues: Issue[];
};
