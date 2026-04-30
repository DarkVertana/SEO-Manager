"use client";

import { useState } from "react";
import type { RewriteRun, RewriteSection } from "./RewriteWorkspace";

export default function DownloadRewriteSummaryButton({
  pageId,
  url,
  pageTitle,
  runs,
}: {
  pageId: string;
  url: string;
  pageTitle: string | null;
  runs: RewriteRun[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      // Prefer the in-memory run log (rich format with prompts + timestamps).
      // If empty (page was refreshed since the rewrite ran), reconstruct a
      // single synthetic run from the original-vs-current diff stored on disk.
      let workingRuns: RewriteRun[] = runs;
      if (workingRuns.length === 0) {
        const res = await fetch(`/api/seo/rewrite/${pageId}/diff`);
        const data = (await res.json().catch(() => ({}))) as {
          sections?: RewriteSection[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Could not load diff");
        const sections = data.sections ?? [];
        if (sections.length === 0) {
          throw new Error("No rewrite changes detected on this capture yet.");
        }
        workingRuns = [
          {
            prompt: "(Reconstructed from saved capture — original prompt history was lost on refresh.)",
            startedAt: new Date().toISOString(),
            sections,
          },
        ];
      }

      const [{ pdf }, { RewriteSummaryDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./RewriteSummaryPdf"),
      ]);
      const generatedAt = new Date().toISOString();
      const blob = await pdf(
        <RewriteSummaryDocument
          url={url}
          pageTitle={pageTitle}
          generatedAt={generatedAt}
          runs={workingRuns}
        />,
      ).toBlob();

      let host = "page";
      try { host = new URL(url).hostname.replace(/^www\./, ""); } catch {}
      const date = new Date().toISOString().slice(0, 10);
      const filename = `rewrite-summary-${host}-${date}.pdf`;

      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate PDF");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={download}
        disabled={busy}
        title={
          runs.length > 0
            ? `Download a PDF with each section's before / after text (${runs.length} run${runs.length === 1 ? "" : "s"})`
            : "Download a PDF reconstructed from the saved capture diff"
        }
        className="border border-hairline px-3 py-1.5 text-xs hover:border-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Generating PDF…" : "Download summary ↓"}
      </button>
      {error && <span className="max-w-[16rem] text-right text-[10px] text-accent">{error}</span>}
    </div>
  );
}
