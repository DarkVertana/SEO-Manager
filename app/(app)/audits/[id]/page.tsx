import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/server";
import type { ArchitectureReport, AuditReport, PageReport, ProgrammaticReport } from "@/lib/seo/types";
import AuditReportView from "./AuditReportView";

// We pre-allocate the SeoAnalysis row before the streaming route starts so
// the form always has an id to redirect to (see app/api/seo/audit/route.ts).
// The placeholder report stays in the DB until the stream's db.update fires
// after every agent finishes. If the function dies first (Vercel timeout,
// dropped trailing chunk) the user can still land here — render an
// auto-refreshing "still running" page instead of crashing AuditReportView.
function isInProgress(report: unknown): boolean {
  return (
    !!report &&
    typeof report === "object" &&
    (("status" in report && (report as { status: unknown }).status === "in_progress") ||
      !("command" in report))
  );
}

export default async function AuditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { id } = await params;

  const record = await db.seoAnalysis.findFirst({
    where: { id, userId: session.uid },
  });

  if (!record) notFound();

  if (isInProgress(record.report)) {
    return (
      <div className="mx-auto flex min-h-[calc(100dvh-130px)] w-full max-w-2xl flex-col items-center justify-center gap-6 px-4 py-10 text-center sm:px-6 sm:py-16">
        <meta httpEquiv="refresh" content="4" />
        <span className="swiss-eyebrow text-muted">— /seo {record.command} pipeline</span>
        <h1 className="text-balance text-3xl font-medium leading-[1.05] tracking-tight sm:text-4xl">
          Still running…
        </h1>
        <p className="break-all font-mono text-[11px] text-muted">{record.url}</p>
        <p className="max-w-md text-pretty text-sm leading-relaxed text-muted sm:text-base">
          The pipeline is finishing up. This page reloads every few seconds and
          will switch to your full report as soon as the agents are done.
        </p>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="inline-block h-1 w-1 animate-pulse bg-foreground" />
          <span>Polling for results…</span>
        </div>
      </div>
    );
  }

  const report = record.report as unknown as AuditReport | PageReport | ArchitectureReport | ProgrammaticReport;
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-10 sm:px-6 sm:py-12 lg:px-12">
      <AuditReportView record={{
        id: record.id,
        url: record.url,
        command: record.command,
        industry: record.industry,
        createdAt: record.createdAt.toISOString(),
        report,
      }} />
    </div>
  );
}
