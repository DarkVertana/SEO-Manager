"use client";

import Link from "next/link";
import type { Issue, Priority, ProgrammaticReport } from "@/lib/seo/types";
import CountUp from "./CountUp";

type ProgrammaticRecord = {
  id: string;
  url: string;
  command: string;
  industry: string | null;
  createdAt: string;
  report: ProgrammaticReport;
};

const PRIORITY_ORDER: Priority[] = ["Critical", "High", "Medium", "Low"];

const PRIORITY_BADGE: Record<Priority, string> = {
  Critical: "bg-accent text-white",
  High: "bg-foreground text-background",
  Medium: "border border-foreground bg-transparent text-foreground",
  Low: "border border-hairline bg-transparent text-muted",
};

const STATUS_GLYPH = { pass: "✓", warn: "⚠", fail: "✗" } as const;
const STATUS_COLOR = {
  pass: "text-emerald-700 dark:text-emerald-400",
  warn: "text-amber-700 dark:text-amber-500",
  fail: "text-accent",
} as const;

export default function ProgrammaticView({ record }: { record: ProgrammaticRecord }) {
  const r = record.report;
  // Quality score = inverse of thin-content risk
  const qualityScore = Math.max(0, Math.min(100, 100 - r.thinContentRiskScore));

  return (
    <div className="flex flex-col gap-10 sm:gap-12 lg:gap-16">
      {/* Header */}
      <div className="flex flex-col gap-6 border-b border-hairline pb-6">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <Link href="/history" className="swiss-eyebrow text-muted hover:text-foreground">
              ← Back to history
            </Link>
            <h1 className="mt-3 break-all text-2xl font-medium tracking-tight">{record.url}</h1>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat eyebrow="Command" value="/seo programmatic" />
          <Stat eyebrow="Industry" value={record.industry ?? "—"} />
          <Stat
            eyebrow="Date"
            value={new Date(record.createdAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "2-digit",
            })}
          />
          <Stat eyebrow="Method" value="Programmatic SEO" />
        </div>
      </div>

      {/* Hero */}
      <section className="grid grid-cols-1 gap-y-8 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <span className="swiss-eyebrow text-muted">— 01 / Quality Score</span>
          <div className="mt-3 flex items-baseline gap-3">
            <CountUp
              value={qualityScore}
              className="font-mono text-[5rem] font-medium leading-none tracking-tight swiss-num sm:text-[6.5rem] lg:text-[8rem]"
            />
            <span className="text-xl text-muted">/100</span>
          </div>
          <p className="mt-3 text-xs text-muted">
            Thin-content risk: <span className="font-mono swiss-num">{r.thinContentRiskScore}/100</span> (lower is better)
          </p>
          <p className="mt-6 max-w-md text-sm leading-relaxed">{r.summary}</p>
        </div>
        <div className="lg:col-span-7 lg:border-l lg:border-hairline lg:pl-12">
          <span className="swiss-eyebrow text-muted">Recommended Playbook</span>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-3xl font-medium tracking-tight">{r.recommendedPlaybook}</span>
          </div>
          {r.alternativePlaybooks.length > 0 && (
            <div className="mt-6 border-t border-hairline pt-4">
              <span className="swiss-eyebrow text-muted">Alternatives</span>
              <ul className="mt-2 space-y-2 text-sm">
                {r.alternativePlaybooks.map((alt, i) => (
                  <li key={i}>
                    <span className="font-medium">{alt.name}</span>
                    <span className="text-muted"> — {alt.rationale}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-hairline pt-4">
            <Stat eyebrow="Realistic pages" value={String(r.estimatedPageCount.realistic)} />
            <Stat eyebrow="Aspirational" value={String(r.estimatedPageCount.aspirational)} />
          </div>
          <p className="mt-2 text-xs text-muted">{r.estimatedPageCount.rationale}</p>
        </div>
      </section>

      {/* Pattern Analysis */}
      <section>
        <span className="swiss-eyebrow text-muted">— 02 / Keyword Pattern</span>
        <div className="mt-4 border border-hairline p-6">
          <div className="font-mono text-lg">{r.patternAnalysis.keywordPattern}</div>
          <div className="mt-2 text-xs text-muted">
            ~{r.patternAnalysis.estimatedUniqueCombinations} unique combinations · intent: {r.patternAnalysis.searchIntentSummary}
          </div>
          {r.patternAnalysis.variables.length > 0 && (
            <table className="mt-4 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-xs swiss-eyebrow text-muted">
                  <th className="py-2 pr-4">Variable</th>
                  <th className="py-2 pr-4">Example</th>
                  <th className="py-2 pr-4">Source Tier</th>
                </tr>
              </thead>
              <tbody>
                {r.patternAnalysis.variables.map((v, i) => (
                  <tr key={i} className="border-b border-hairline">
                    <td className="py-2 pr-4 font-mono">{`{${v.name}}`}</td>
                    <td className="py-2 pr-4">{v.example}</td>
                    <td className="py-2 pr-4">
                      <span className={`inline-block px-2 py-0.5 text-[10px] tracking-widest ${
                        v.sourceTier <= 2 ? "bg-emerald-700 text-white" :
                        v.sourceTier === 3 ? "border border-foreground" :
                        "border border-hairline text-muted"
                      }`}>
                        TIER {v.sourceTier}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="mt-3 text-xs text-muted">
            Tier 1 = proprietary, Tier 5 = public. Higher tiers = stronger defensibility.
          </div>
        </div>
      </section>

      {/* Page Template */}
      <section>
        <span className="swiss-eyebrow text-muted">— 03 / Page Template</span>
        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="border border-hairline p-4">
            <div className="swiss-eyebrow text-muted">URL pattern</div>
            <div className="mt-2 font-mono text-sm">{r.pageTemplate.urlPattern}</div>
            <div className="mt-4 swiss-eyebrow text-muted">Title template</div>
            <div className="mt-2 font-mono text-sm">{r.pageTemplate.titleTemplate}</div>
            <div className="mt-4 swiss-eyebrow text-muted">Meta description template</div>
            <div className="mt-2 font-mono text-xs">{r.pageTemplate.metaDescriptionTemplate}</div>
            <div className="mt-4 swiss-eyebrow text-muted">H1 template</div>
            <div className="mt-2 font-mono text-sm">{r.pageTemplate.h1Template}</div>
          </div>
          <div className="border border-hairline p-4">
            <div className="swiss-eyebrow text-muted">Sample rendered page</div>
            <div className="mt-2 space-y-2 text-sm">
              <div>
                <span className="text-xs swiss-eyebrow text-muted">URL</span>
                <div className="font-mono text-xs">{r.pageTemplate.sampleRenderedPage.url}</div>
              </div>
              <div>
                <span className="text-xs swiss-eyebrow text-muted">Title ({r.pageTemplate.sampleRenderedPage.title.length} chars)</span>
                <div>{r.pageTemplate.sampleRenderedPage.title}</div>
              </div>
              <div>
                <span className="text-xs swiss-eyebrow text-muted">Meta ({r.pageTemplate.sampleRenderedPage.metaDescription.length} chars)</span>
                <div className="text-xs text-muted">{r.pageTemplate.sampleRenderedPage.metaDescription}</div>
              </div>
              <div>
                <span className="text-xs swiss-eyebrow text-muted">H1</span>
                <div className="font-medium">{r.pageTemplate.sampleRenderedPage.h1}</div>
              </div>
            </div>
          </div>
        </div>

        {r.pageTemplate.sections.length > 0 && (
          <div className="mt-6">
            <span className="swiss-eyebrow text-muted">Sections (each must declare its uniqueness source)</span>
            <table className="mt-2 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-xs swiss-eyebrow text-muted">
                  <th className="py-2 pr-4">Heading</th>
                  <th className="py-2 pr-4">Purpose</th>
                  <th className="py-2 pr-4">Uniqueness Source</th>
                </tr>
              </thead>
              <tbody>
                {r.pageTemplate.sections.map((s, i) => (
                  <tr key={i} className="border-b border-hairline">
                    <td className="py-2 pr-4 font-medium">{s.heading}</td>
                    <td className="py-2 pr-4 text-muted">{s.purpose}</td>
                    <td className="py-2 pr-4 text-xs">{s.uniquenessSource}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {r.pageTemplate.schemaJsonLd && (
          <div className="mt-6">
            <span className="swiss-eyebrow text-muted">Schema (JSON-LD)</span>
            <pre className="mt-2 overflow-x-auto border border-hairline bg-zinc-50/70 p-4 text-xs leading-relaxed backdrop-blur-sm dark:bg-zinc-900/60">
              <code>{r.pageTemplate.schemaJsonLd}</code>
            </pre>
          </div>
        )}
      </section>

      {/* Internal Linking Plan */}
      <section>
        <span className="swiss-eyebrow text-muted">— 04 / Internal Linking Plan (Hub-and-Spoke)</span>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="border border-hairline p-4">
            <div className="swiss-eyebrow text-muted">Hub page</div>
            <div className="mt-2 font-mono text-sm">{r.internalLinkingPlan.hubPage}</div>
          </div>
          <div className="border border-hairline p-4">
            <div className="swiss-eyebrow text-muted">Spoke pattern</div>
            <div className="mt-2 text-sm">{r.internalLinkingPlan.spokePattern}</div>
          </div>
          <div className="border border-hairline p-4">
            <div className="swiss-eyebrow text-muted">Cross-link rules</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
              {r.internalLinkingPlan.crossLinkRules.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Indexation Strategy */}
      <section>
        <span className="swiss-eyebrow text-muted">— 05 / Indexation Strategy</span>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="border border-hairline p-4">
            <div className="swiss-eyebrow text-muted">Sitemap</div>
            <p className="mt-2 text-sm">{r.indexationStrategy.sitemapStrategy}</p>
          </div>
          <div className="border border-hairline p-4">
            <div className="swiss-eyebrow text-muted">Noindex criteria</div>
            <p className="mt-2 text-sm">{r.indexationStrategy.noindexCriteria}</p>
          </div>
          <div className="border border-hairline p-4">
            <div className="swiss-eyebrow text-muted">Crawl budget</div>
            <p className="mt-2 text-sm">{r.indexationStrategy.crawlBudgetNotes}</p>
          </div>
        </div>
      </section>

      {/* Data Requirements */}
      <section>
        <span className="swiss-eyebrow text-muted">— 06 / Data Requirements</span>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="border border-hairline p-4">
            <div className="swiss-eyebrow text-muted">Proprietary data needed (the moat)</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
              {r.dataRequirements.proprietaryDataNeeded.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
          <div className="border border-hairline p-4">
            <div className="swiss-eyebrow text-muted">Public data acceptable</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
              {r.dataRequirements.publicDataAcceptable.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
          <div className="border border-hairline p-4">
            <div className="swiss-eyebrow text-muted">Refresh cadence</div>
            <p className="mt-2 text-sm">{r.dataRequirements.refreshCadence}</p>
          </div>
        </div>
      </section>

      {/* Quality Checklist */}
      {r.qualityChecklist.length > 0 && (
        <section>
          <span className="swiss-eyebrow text-muted">— 07 / Pre-Launch Quality Checklist</span>
          <ul className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            {r.qualityChecklist.map((c, i) => (
              <li key={i} className="flex items-start gap-2 border-l border-hairline pl-3">
                <span className={STATUS_COLOR[c.status]}>{STATUS_GLYPH[c.status]}</span>
                <span>
                  <span className="font-medium">{c.check}</span>
                  {c.detail ? <span className="text-muted"> — {c.detail}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Issues */}
      {r.issues.length > 0 && (
        <section>
          <span className="swiss-eyebrow text-muted">— 08 / Risks & Issues</span>
          <div className="mt-4 border-t border-hairline">
            {[...r.issues]
              .sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority))
              .map((issue, i) => (
                <IssueLine key={i} issue={issue} />
              ))}
          </div>
        </section>
      )}
    </div>
  );
}

function IssueLine({ issue }: { issue: Issue }) {
  return (
    <div className="grid grid-cols-12 gap-3 border-b border-hairline py-4 text-sm">
      <div className="col-span-12 sm:col-span-2">
        <span className={`inline-block px-2 py-0.5 text-[10px] tracking-widest ${PRIORITY_BADGE[issue.priority]}`}>
          {issue.priority.toUpperCase()}
        </span>
        <div className="mt-2 swiss-eyebrow text-muted">{issue.category}</div>
        {issue.effort && <div className="mt-1 text-xs text-muted">effort: {issue.effort}</div>}
      </div>
      <div className="col-span-12 sm:col-span-10">
        <h4 className="font-medium">{issue.title}</h4>
        <p className="mt-1 text-muted">{issue.description}</p>
        <p className="mt-2">
          <span className="swiss-eyebrow text-muted">Fix:</span> {issue.recommendation}
        </p>
      </div>
    </div>
  );
}

function Stat({ eyebrow, value, sub }: { eyebrow: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="swiss-eyebrow text-muted">{eyebrow}</span>
      <span className="text-base font-medium">{value}</span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </div>
  );
}
