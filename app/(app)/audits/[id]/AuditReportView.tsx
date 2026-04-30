"use client";

import Link from "next/link";
import type { ArchitectureReport, AuditReport, CategoryReport, Issue, PageReport, Priority, ProgrammaticReport } from "@/lib/seo/types";
import ArchitectureView from "./ArchitectureView";
import CountUp from "./CountUp";
import DownloadPdfButton from "./DownloadPdfButton";
import ProgrammaticView from "./ProgrammaticView";

type AuditRecord = {
  id: string;
  url: string;
  command: string;
  industry: string | null;
  createdAt: string;
  report: AuditReport | PageReport | ArchitectureReport | ProgrammaticReport;
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

type AnyReport = AuditReport | PageReport | ArchitectureReport | ProgrammaticReport;

function isAudit(r: AnyReport): r is AuditReport {
  return r.command === "audit";
}

function isArchitecture(r: AnyReport): r is ArchitectureReport {
  return r.command === "architecture";
}

function isProgrammatic(r: AnyReport): r is ProgrammaticReport {
  return r.command === "programmatic";
}

export default function AuditReportView({ record }: { record: AuditRecord }) {
  if (isArchitecture(record.report)) {
    return (
      <ArchitectureView
        record={{
          id: record.id,
          url: record.url,
          command: record.command,
          industry: record.industry,
          createdAt: record.createdAt,
          report: record.report,
        }}
      />
    );
  }
  if (isProgrammatic(record.report)) {
    return (
      <ProgrammaticView
        record={{
          id: record.id,
          url: record.url,
          command: record.command,
          industry: record.industry,
          createdAt: record.createdAt,
          report: record.report,
        }}
      />
    );
  }
  return isAudit(record.report) ? (
    <FullAudit record={record as AuditRecord & { report: AuditReport }} />
  ) : (
    <PageDetail record={record as AuditRecord & { report: PageReport }} />
  );
}

/* ---------- Shared atoms ---------- */

function ScoreCell({ value, weightLabel }: { value: number; weightLabel?: string }) {
  return (
    <div className="flex flex-col items-end gap-1">
      {weightLabel && <span className="swiss-eyebrow text-muted">{weightLabel}</span>}
      <div className="font-mono text-2xl font-medium swiss-num">
        {value}
        <span className="text-xs text-muted">/100</span>
      </div>
    </div>
  );
}

function ScoreRow({ label, value, weight }: { label: string; value: number; weight?: string }) {
  return (
    <div className="grid grid-cols-12 items-center gap-3 border-b border-hairline py-3">
      <span className="col-span-5 text-sm">{label}</span>
      {weight ? (
        <span className="col-span-2 swiss-eyebrow text-muted">{weight}</span>
      ) : (
        <span className="col-span-2" />
      )}
      <div className="col-span-3 h-1 bg-hairline">
        <div
          className={`h-full ${value >= 80 ? "bg-emerald-600" : value >= 60 ? "bg-amber-600" : "bg-accent"}`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
      <span className="col-span-2 text-right font-mono text-sm swiss-num">
        {value}
        <span className="text-xs text-muted">/100</span>
      </span>
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

function CategoryBlock({ index, title, report }: { index: string; title: string; report: CategoryReport }) {
  return (
    <details className="border-t border-hairline" open={report.status === "fail"}>
      <summary className="grid cursor-pointer grid-cols-12 items-center gap-3 py-4">
        <span className="col-span-1 text-xs text-muted swiss-num">{index}</span>
        <span className={`col-span-1 text-lg ${STATUS_COLOR[report.status]}`}>{STATUS_GLYPH[report.status]}</span>
        <span className="col-span-7 font-medium">{title}</span>
        <span className="col-span-3 text-right font-mono text-base swiss-num">
          {report.score}<span className="text-xs text-muted">/100</span>
        </span>
      </summary>
      <div className="grid grid-cols-1 gap-6 border-t border-hairline py-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <span className="swiss-eyebrow text-muted">Summary</span>
          <p className="mt-2 text-sm leading-relaxed">{report.summary}</p>
        </div>
        <div className="lg:col-span-8">
          {report.findings.length > 0 && (
            <ul className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              {report.findings.map((f, i) => (
                <li key={i} className="flex items-start gap-2 border-l border-hairline pl-3">
                  <span className={STATUS_COLOR[f.status]}>{STATUS_GLYPH[f.status]}</span>
                  <span>
                    <span className="font-medium">{f.label}</span>
                    {f.detail ? <span className="text-muted"> — {f.detail}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {report.issues.length > 0 && (
            <div className="mt-6">
              <span className="swiss-eyebrow text-muted">Issues</span>
              <div className="mt-2 border-t border-hairline">
                {report.issues.map((issue, i) => <IssueLine key={i} issue={issue} />)}
              </div>
            </div>
          )}
        </div>
      </div>
    </details>
  );
}

/* ---------- Full audit view ---------- */

function FullAudit({ record }: { record: AuditRecord & { report: AuditReport } }) {
  const a = record.report;
  const totalIssues = Object.values(a.categories)
    .reduce((acc: number, c) => acc + (c.issues?.length ?? 0), 0);

  return (
    <div className="flex flex-col gap-10 sm:gap-12 lg:gap-16">
      <Header record={record} />

      {/* Hero score */}
      <section className="grid grid-cols-1 gap-y-8 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <span className="swiss-eyebrow text-muted">— 01 / Health Score</span>
          <div className="mt-3 flex items-baseline gap-3">
            <CountUp
              value={a.overallScore}
              className="font-mono text-[5rem] font-medium leading-none tracking-tight swiss-num sm:text-[6.5rem] lg:text-[8rem]"
            />
            <span className="text-xl text-muted">/100</span>
          </div>
          <p className="mt-6 max-w-md text-sm leading-relaxed">{a.executiveSummary}</p>
        </div>
        <div className="lg:col-span-7 lg:border-l lg:border-hairline lg:pl-12">
          <span className="swiss-eyebrow text-muted">Weighted breakdown</span>
          <div className="mt-3">
            <ScoreRow label="Technical SEO" value={a.scores.technical} weight="22%" />
            <ScoreRow label="Content Quality" value={a.scores.content} weight="23%" />
            <ScoreRow label="On-Page SEO" value={a.scores.onPage} weight="20%" />
            <ScoreRow label="Schema / Structured Data" value={a.scores.schema} weight="10%" />
            <ScoreRow label="Performance / CWV" value={a.scores.performance} weight="10%" />
            <ScoreRow label="AI Search Readiness" value={a.scores.aiSearchReadiness} weight="10%" />
            <ScoreRow label="Images" value={a.scores.images} weight="05%" />
          </div>
        </div>
      </section>

      {/* Industry + counts */}
      <section className="grid grid-cols-2 gap-x-6 gap-y-4 border-y border-hairline py-6 lg:grid-cols-4">
        <Stat eyebrow="Industry" value={a.industry.industry} sub={`${a.industry.confidence} confidence`} />
        <Stat eyebrow="Page Type" value={a.industry.pageType} sub="Detected" />
        <Stat eyebrow="Issues" value={String(totalIssues)} sub="Total findings" />
        <Stat eyebrow="Critical" value={String(a.topCriticalIssues.length)} sub="Immediate fixes" />
      </section>

      {/* Top critical + quick wins */}
      {a.topCriticalIssues.length > 0 && (
        <section>
          <span className="swiss-eyebrow text-muted">— 02 / Top Critical Issues</span>
          <div className="mt-4 border-t border-hairline">
            {a.topCriticalIssues.map((i, idx) => <IssueLine key={idx} issue={i} />)}
          </div>
        </section>
      )}
      {a.topQuickWins.length > 0 && (
        <section>
          <span className="swiss-eyebrow text-muted">— 03 / Top Quick Wins</span>
          <div className="mt-4 border-t border-hairline">
            {a.topQuickWins.map((i, idx) => <IssueLine key={idx} issue={i} />)}
          </div>
        </section>
      )}

      {/* Categories */}
      <section>
        <span className="swiss-eyebrow text-muted">— 04 / Category Breakdown</span>
        <div className="mt-4">
          <CategoryBlock index="04.1" title="Technical SEO" report={a.categories.technical} />
          <CategoryBlock index="04.2" title="Content Quality + E-E-A-T" report={a.categories.content} />
          <CategoryBlock index="04.3" title="On-Page SEO" report={a.categories.onPage} />
          <CategoryBlock index="04.4" title="Schema / Structured Data" report={a.categories.schema} />
          <CategoryBlock index="04.5" title="Performance / Core Web Vitals" report={a.categories.performance} />
          <CategoryBlock index="04.6" title="AI Search Readiness (GEO)" report={a.categories.aiSearchReadiness} />
          <CategoryBlock index="04.7" title="Images" report={a.categories.images} />
          <div className="border-b border-hairline" />
        </div>
      </section>

      {/* E-E-A-T detail */}
      <section>
        <span className="swiss-eyebrow text-muted">— 05 / E-E-A-T Breakdown</span>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(a.categories.content.eeat) as (keyof typeof a.categories.content.eeat)[]).map((k) => (
            <div key={k} className="border border-hairline p-4">
              <div className="flex items-baseline justify-between border-b border-hairline pb-2">
                <span className="swiss-eyebrow">{k}</span>
                <span className="font-mono text-lg swiss-num">
                  {a.categories.content.eeat[k].score}
                  <span className="text-xs text-muted">/100</span>
                </span>
              </div>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted">
                {a.categories.content.eeat[k].signals.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-baseline justify-between border-t border-hairline pt-3 text-sm">
          <span className="swiss-eyebrow text-muted">AI Citation Readiness</span>
          <span className="font-mono swiss-num">
            {a.categories.content.aiCitationReadiness}<span className="text-xs text-muted">/100</span>
          </span>
        </div>
      </section>

      {/* Schema suggestions */}
      {a.categories.schema.suggestions.length > 0 && (
        <section>
          <span className="swiss-eyebrow text-muted">— 06 / Schema Suggestions (JSON-LD)</span>
          <div className="mt-4 flex flex-col gap-3">
            {a.categories.schema.suggestions.map((snippet, i) => (
              <pre key={i} className="overflow-x-auto border border-hairline bg-zinc-50/70 p-4 text-xs leading-relaxed backdrop-blur-sm dark:bg-zinc-900/60">
                <code>{snippet}</code>
              </pre>
            ))}
          </div>
        </section>
      )}

      {/* Action plan */}
      <section>
        <span className="swiss-eyebrow text-muted">— 07 / Prioritized Action Plan</span>
        <div className="mt-4">
          {PRIORITY_ORDER.map((p) => {
            const bucket = a.actionPlan.find((b) => b.priority === p);
            if (!bucket || bucket.items.length === 0) return null;
            return (
              <details key={p} className="border-t border-hairline" open={p === "Critical" || p === "High"}>
                <summary className="grid cursor-pointer grid-cols-12 items-center gap-3 py-3">
                  <span className="col-span-2">
                    <span className={`inline-block px-2 py-0.5 text-[10px] tracking-widest ${PRIORITY_BADGE[p]}`}>
                      {p.toUpperCase()}
                    </span>
                  </span>
                  <span className="col-span-8 text-sm text-muted">
                    {bucket.items.length} item{bucket.items.length === 1 ? "" : "s"}
                  </span>
                </summary>
                <div className="border-t border-hairline">
                  {bucket.items.map((issue, i) => <IssueLine key={i} issue={issue} />)}
                </div>
              </details>
            );
          })}
          <div className="border-b border-hairline" />
        </div>
      </section>

    </div>
  );
}

/* ---------- Single-page detail view ---------- */

function PageDetail({ record }: { record: AuditRecord & { report: PageReport } }) {
  const r = record.report;
  return (
    <div className="flex flex-col gap-10 sm:gap-12 lg:gap-16">
      <Header record={record} />

      <section className="grid grid-cols-1 gap-y-8 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <span className="swiss-eyebrow text-muted">— 01 / Page Score</span>
          <div className="mt-3 flex items-baseline gap-3">
            <CountUp
              value={r.overallScore}
              className="font-mono text-[5rem] font-medium leading-none tracking-tight swiss-num sm:text-[6.5rem] lg:text-[8rem]"
            />
            <span className="text-xl text-muted">/100</span>
          </div>
          <p className="mt-6 max-w-md text-sm leading-relaxed">{r.summary}</p>
        </div>
        <div className="lg:col-span-7 lg:border-l lg:border-hairline lg:pl-12">
          <span className="swiss-eyebrow text-muted">Pillars</span>
          <div className="mt-3">
            {r.scoreCard.map((s) => <ScoreRow key={s.label} label={s.label} value={s.score} />)}
          </div>
        </div>
      </section>

      {r.issues.length > 0 && (
        <section>
          <span className="swiss-eyebrow text-muted">— 02 / Issues Found</span>
          <div className="mt-4 border-t border-hairline">
            {[...r.issues].sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)).map((issue, i) => (
              <IssueLine key={i} issue={issue} />
            ))}
          </div>
        </section>
      )}

      {r.schemaSuggestions.length > 0 && (
        <section>
          <span className="swiss-eyebrow text-muted">— 03 / Schema Suggestions</span>
          <div className="mt-4 flex flex-col gap-3">
            {r.schemaSuggestions.map((snippet, i) => (
              <pre key={i} className="overflow-x-auto border border-hairline bg-zinc-50/70 p-4 text-xs leading-relaxed backdrop-blur-sm dark:bg-zinc-900/60">
                <code>{snippet}</code>
              </pre>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}

function Header({ record }: { record: AuditRecord & { report: AuditReport | PageReport } }) {
  return (
    <div className="flex flex-col gap-6 border-b border-hairline pb-6">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <Link href="/history" className="swiss-eyebrow text-muted hover:text-foreground">
            ← Back to history
          </Link>
          <h1 className="mt-3 break-all text-2xl font-medium tracking-tight">{record.url}</h1>
        </div>
        <DownloadPdfButton record={record} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat eyebrow="Command" value={`/seo ${record.command}`} />
        <Stat eyebrow="Industry" value={record.industry ?? "—"} />
        <Stat
          eyebrow="Date"
          value={new Date(record.createdAt).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "2-digit",
          })}
        />
        <Stat eyebrow="Method" value="7-agent audit" />
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
