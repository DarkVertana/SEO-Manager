"use client";

import { useEffect } from "react";

export type ProgressStep = {
  index: number;
  label: string;
  status: "pending" | "queued" | "running" | "done" | "failed";
  durationMs?: number;
  error?: string;
};

// Centered Swiss-styled overlay that mirrors the agent pipeline live as the
// audit streams. Replaces the inline step list under the form so the user's
// attention is fully on what's happening; auto-closes via the parent when
// navigation fires after `complete`.
export default function AuditProgressModal({
  open,
  url,
  skill,
  steps,
  error,
  onClose,
}: {
  open: boolean;
  url: string;
  skill: string;
  steps: ProgressStep[];
  error: string | null;
  onClose?: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const total = steps.length;
  const done = steps.filter((s) => s.status === "done").length;
  const isFinished = total > 0 && done === total && !error;
  const elapsedMs = steps.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-4 py-8 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Running /seo ${skill}`}
    >
      <div className="flex w-full max-w-2xl flex-col gap-6 border border-hairline bg-background p-6 shadow-xl sm:p-8">
        <header className="flex items-start justify-between gap-4 border-b border-hairline pb-4">
          <div className="flex flex-col gap-1">
            <span className="swiss-eyebrow text-muted">— /seo {skill} pipeline</span>
            <h2 className="text-balance text-lg font-medium tracking-tight sm:text-xl">
              {error ? "Pipeline failed" : isFinished ? "Pipeline complete" : "Auditing in progress…"}
            </h2>
            <p className="break-all font-mono text-[11px] text-muted">{url}</p>
          </div>
          <div className="flex flex-col items-end gap-1 text-right">
            <span className="swiss-eyebrow text-muted">Progress</span>
            <span className="font-mono text-sm tracking-tight">
              {done}/{total || "—"}
            </span>
            <span className="font-mono text-[10px] text-muted">
              {elapsedMs > 0 ? `${(elapsedMs / 1000).toFixed(1)}s` : ""}
            </span>
          </div>
        </header>

        {error && (
          <div className="border border-accent px-4 py-3 text-sm text-accent">{error}</div>
        )}

        <ol className="flex flex-col">
          {steps.map((s) => {
            const num = s.index.toString().padStart(2, "0");
            const isQueued = s.status === "queued";
            const isRunning = s.status === "running";
            const isDone = s.status === "done";
            const isFailed = s.status === "failed";
            const isActive = isQueued || isRunning;
            return (
              <li
                key={s.index}
                className="flex items-center gap-3 border-b border-hairline py-2 last:border-b-0"
              >
                <span className="w-8 font-mono text-[10px] tracking-wider text-muted">{num}</span>
                <span
                  className={`inline-block h-2 w-2 shrink-0 transition-colors ${
                    isFailed
                      ? "bg-accent"
                      : isDone
                        ? "bg-foreground"
                        : isRunning
                          ? "animate-pulse bg-foreground"
                          : isQueued
                            ? "bg-hairline"
                            : "border border-hairline"
                  }`}
                  aria-hidden
                />
                <span
                  className={`flex-1 text-sm transition-colors ${
                    isDone || isFailed || isActive ? "text-foreground" : "text-muted"
                  }`}
                >
                  {s.label}
                  {isFailed && s.error && (
                    <span className="ml-2 text-xs text-accent">— {s.error}</span>
                  )}
                </span>
                <span className="font-mono text-[10px] text-muted">
                  {isQueued && "queued…"}
                  {isRunning && "running…"}
                  {isDone && s.durationMs != null && `${(s.durationMs / 1000).toFixed(1)}s`}
                  {isFailed && "failed"}
                </span>
              </li>
            );
          })}
          {steps.length === 0 && (
            <li className="flex items-center gap-3 py-2 text-sm text-muted">
              <span className="inline-block h-2 w-2 animate-pulse bg-foreground" aria-hidden />
              <span>Initializing pipeline…</span>
            </li>
          )}
        </ol>

        <footer className="flex items-center justify-between border-t border-hairline pt-4 text-xs text-muted">
          <span>
            {error
              ? "You can close this and try again."
              : isFinished
                ? "Redirecting to your report…"
                : "You can close this — the audit will keep running in the background."}
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="border border-hairline px-3 py-1.5 text-[11px] font-medium tracking-wide transition-colors hover:bg-foreground hover:text-background"
            >
              {error || isFinished ? "Close" : "Hide"}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
