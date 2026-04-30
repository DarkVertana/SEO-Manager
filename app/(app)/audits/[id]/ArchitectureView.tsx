"use client";

import Link from "next/link";
import type { ArchitectureReport, Issue, Priority } from "@/lib/seo/types";
import CountUp from "./CountUp";

type ArchitectureRecord = {
  id: string;
  url: string;
  command: string;
  industry: string | null;
  createdAt: string;
  report: ArchitectureReport;
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

export default function ArchitectureView({ record }: { record: ArchitectureRecord }) {
  const r = record.report;

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
          <Stat eyebrow="Command" value="/seo architecture" />
          <Stat eyebrow="Industry" value={record.industry ?? "—"} />
          <Stat
            eyebrow="Date"
            value={new Date(record.createdAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "2-digit",
            })}
          />
          <Stat eyebrow="Method" value="Site Architecture" />
        </div>
      </div>

      {/* Score + summary */}
      <section className="grid grid-cols-1 gap-y-8 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <span className="swiss-eyebrow text-muted">— 01 / Architecture Score</span>
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
          <span className="swiss-eyebrow text-muted">Hierarchy (ASCII)</span>
          <pre className="mt-3 overflow-x-auto border border-hairline bg-zinc-50/70 p-4 text-xs leading-relaxed backdrop-blur-sm dark:bg-zinc-900/60">
            <code>{r.asciiTree}</code>
          </pre>
        </div>
      </section>

      {/* URL Map */}
      {r.urlMap.length > 0 && (
        <section>
          <span className="swiss-eyebrow text-muted">— 02 / URL Map</span>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-xs swiss-eyebrow text-muted">
                  <th className="py-2 pr-4">Page</th>
                  <th className="py-2 pr-4">URL</th>
                  <th className="py-2 pr-4">Parent</th>
                  <th className="py-2 pr-4">Nav</th>
                  <th className="py-2 pr-4">Priority</th>
                </tr>
              </thead>
              <tbody>
                {r.urlMap.map((row, i) => (
                  <tr key={i} className="border-b border-hairline">
                    <td className="py-2 pr-4 font-medium">{row.page}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{row.url}</td>
                    <td className="py-2 pr-4 text-muted">{row.parent}</td>
                    <td className="py-2 pr-4 text-muted">{row.navLocation}</td>
                    <td className="py-2 pr-4">
                      <span className={`inline-block px-2 py-0.5 text-[10px] tracking-widest ${PRIORITY_BADGE[row.priority as Priority] ?? "border border-hairline text-muted"}`}>
                        {row.priority.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Navigation */}
      <section>
        <span className="swiss-eyebrow text-muted">— 03 / Navigation</span>
        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="border border-hairline p-4">
            <div className="flex items-baseline justify-between border-b border-hairline pb-2">
              <span className="swiss-eyebrow">Header</span>
              <span className="font-mono text-sm swiss-num">
                {r.navigation.header.itemCount} items
              </span>
            </div>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
              {r.navigation.header.items.map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ul>
            <div className="mt-3 text-xs text-muted">
              {r.navigation.header.itemsWithinRule
                ? "✓ Within 4-7 item rule"
                : "⚠ Outside 4-7 item rule"}
              {r.navigation.header.ctaLabel && ` · CTA: ${r.navigation.header.ctaLabel}`}
            </div>
          </div>
          <div className="border border-hairline p-4">
            <div className="border-b border-hairline pb-2 swiss-eyebrow">Footer</div>
            <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              {r.navigation.footer.columns.map((col, i) => (
                <div key={i}>
                  <div className="text-xs swiss-eyebrow text-muted">{col.title}</div>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
                    {col.links.map((l, j) => (
                      <li key={j}>{l}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <div className="border border-hairline p-4">
            <div className="border-b border-hairline pb-2 swiss-eyebrow">Breadcrumbs</div>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <span className={STATUS_COLOR[r.navigation.breadcrumbs.present ? "pass" : "fail"]}>
                  {STATUS_GLYPH[r.navigation.breadcrumbs.present ? "pass" : "fail"]}
                </span>{" "}
                Present
              </li>
              <li>
                <span className={STATUS_COLOR[r.navigation.breadcrumbs.mirrorsUrl ? "pass" : "warn"]}>
                  {STATUS_GLYPH[r.navigation.breadcrumbs.mirrorsUrl ? "pass" : "warn"]}
                </span>{" "}
                Mirrors URL hierarchy
              </li>
            </ul>
            <p className="mt-3 text-xs text-muted">{r.navigation.breadcrumbs.notes}</p>
          </div>
        </div>
      </section>

      {/* URL Audit */}
      {(r.urlAudit.findings.length > 0 || r.urlAudit.issues.length > 0) && (
        <section>
          <span className="swiss-eyebrow text-muted">— 04 / URL Hygiene Audit</span>
          {r.urlAudit.findings.length > 0 && (
            <ul className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              {r.urlAudit.findings.map((f, i) => (
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
          {r.urlAudit.issues.length > 0 && (
            <div className="mt-4 border-t border-hairline">
              {r.urlAudit.issues.map((issue, i) => (
                <IssueLine key={i} issue={issue} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Internal Linking */}
      <section>
        <span className="swiss-eyebrow text-muted">— 05 / Internal Linking</span>
        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <div className="swiss-eyebrow text-muted">
              Hub-and-spoke clusters · density observed: {r.internalLinking.linksPer1000WordsObserved}
            </div>
            {r.internalLinking.hubs.length > 0 ? (
              <ul className="mt-3 space-y-3 text-sm">
                {r.internalLinking.hubs.map((h, i) => (
                  <li key={i} className="border border-hairline p-3">
                    <div className="font-medium">Hub: {h.hub}</div>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted">
                      {h.spokes.map((s, j) => (
                        <li key={j}>{s}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">No hub-and-spoke clusters detected.</p>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4">
            {r.internalLinking.orphanRisks.length > 0 && (
              <div className="border border-hairline p-4">
                <div className="swiss-eyebrow text-muted">Orphan risks</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                  {r.internalLinking.orphanRisks.map((o, i) => (
                    <li key={i}>{o}</li>
                  ))}
                </ul>
              </div>
            )}
            {r.internalLinking.crossSectionOpportunities.length > 0 && (
              <div className="border border-hairline p-4">
                <div className="swiss-eyebrow text-muted">Cross-section link opportunities</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                  {r.internalLinking.crossSectionOpportunities.map((o, i) => (
                    <li key={i}>{o}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Mermaid */}
      {r.mermaid && (
        <section>
          <span className="swiss-eyebrow text-muted">— 06 / Mermaid Sitemap</span>
          <pre className="mt-4 overflow-x-auto border border-hairline bg-zinc-50/70 p-4 text-xs leading-relaxed backdrop-blur-sm dark:bg-zinc-900/60">
            <code>{r.mermaid}</code>
          </pre>
          <p className="mt-2 text-xs text-muted">
            Paste into mermaid.live or any Mermaid renderer for a visual sitemap.
          </p>
        </section>
      )}

      {/* Issues */}
      {r.issues.length > 0 && (
        <section>
          <span className="swiss-eyebrow text-muted">— 07 / Architecture Issues</span>
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
