import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/server";
import type { ArchitectureReport, AuditReport, PageReport, ProgrammaticReport } from "@/lib/seo/types";
import AuditReportView from "./AuditReportView";

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
