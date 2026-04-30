"use client";

import { useState } from "react";
import type { AuditReport, PageReport } from "@/lib/seo/types";

type AuditRecord = {
  id: string;
  url: string;
  command: string;
  industry: string | null;
  createdAt: string;
  report: AuditReport | PageReport;
};

function fileNameFor(record: AuditRecord): string {
  let host = "report";
  try {
    host = new URL(record.url).hostname.replace(/^www\./, "");
  } catch {
    // ignore
  }
  const date = new Date(record.createdAt).toISOString().slice(0, 10);
  return `seo-${record.command}-${host}-${date}.pdf`;
}

export default function DownloadPdfButton({ record }: { record: AuditRecord }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setLoading(true);
    setError(null);
    try {
      const [{ pdf }, { AuditPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./AuditPdf"),
      ]);

      const generatedAt = new Date().toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });

      const blob = await pdf(<AuditPdfDocument record={record} generatedAt={generatedAt} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileNameFor(record);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate PDF");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={download}
        disabled={loading}
        className="bg-foreground px-5 py-2.5 text-sm font-medium tracking-wide text-background transition-opacity hover:opacity-85 disabled:opacity-50"
      >
        {loading ? "Generating PDF…" : "Download PDF ↓"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-accent">
          {error}
        </span>
      )}
    </div>
  );
}
