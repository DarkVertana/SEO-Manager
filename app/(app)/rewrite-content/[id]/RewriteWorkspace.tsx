"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import GeneratePanel from "./GeneratePanel";
import DownloadRewriteSummaryButton from "./DownloadRewriteSummaryButton";

type RewriteRecord = {
  id: string;
  url: string;
  title: string | null;
  byteSize: number;
  createdAt: string;
  updatedAt: string;
};

export type RewriteReplacement = { id: number; before: string; text: string };
export type RewriteSection = {
  index: number; // 0-based; UI shows index + 1 as @sectionN
  heading: string | null;
  replacements: RewriteReplacement[];
};
export type RewriteRun = {
  prompt: string;
  startedAt: string;
  sections: RewriteSection[];
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export default function RewriteWorkspace({ record }: { record: RewriteRecord }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [iframeLoading, setIframeLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [researchOpen, setResearchOpen] = useState(false);
  // Aggregated diff log across every rewrite run, used by the
  // "Download summary →" button to render a hand-off PDF for developers.
  const [summary, setSummary] = useState<RewriteRun[]>([]);
  const [progress, setProgress] = useState<{
    total: number;
    current: number;
    phase: "preparing" | "analyzing" | "generating" | "replacing" | "idle";
    statuses: ("pending" | "running" | "done" | "error")[];
    indices: number[]; // original section index for each status slot
    targeted: boolean;
  } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const previewUrl = useMemo(
    () => `/api/seo/rewrite/${record.id}/preview?v=${iframeKey}`,
    [record.id, iframeKey],
  );

  async function submit() {
    const text = prompt.trim();
    if (!text) return;
    setError(null);
    setSuccess(null);
    setLoading(true);
    setProgress(null);

    // Open a new run on the summary log; we append a section per
    // `section-complete` event below.
    const runStartedAt = new Date().toISOString();
    setSummary((s) => [...s, { prompt: text, startedAt: runStartedAt, sections: [] }]);

    try {
      const res = await fetch(`/api/seo/rewrite/${record.id}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "We couldn't apply that change. Please try again.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let lastSectionFinished = -1;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newlineIdx;
        while ((newlineIdx = buffer.indexOf("\n\n")) !== -1) {
          const chunk = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 2);
          const dataLine = chunk.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          let event: { type: string; [k: string]: unknown };
          try {
            event = JSON.parse(dataLine.slice(6));
          } catch {
            continue;
          }
          if (event.type === "session-prepare") {
            const total = Number(event.total ?? 0);
            const indices: number[] = Array.isArray(event.indices)
              ? (event.indices as number[])
              : Array.from({ length: total }, (_, i) => i);
            setProgress({
              total,
              current: 0,
              phase: "preparing",
              statuses: Array.from({ length: total }, () => "pending"),
              indices,
              targeted: Boolean(event.targeted),
            });
          } else if (event.type === "ready") {
            const total = Number(event.total ?? 0);
            const indices: number[] = Array.isArray(event.indices)
              ? (event.indices as number[])
              : Array.from({ length: total }, (_, i) => i);
            setProgress((p) =>
              p
                ? { ...p, phase: "idle" }
                : {
                    total,
                    current: 0,
                    phase: "idle",
                    statuses: Array.from({ length: total }, () => "pending"),
                    indices,
                    targeted: Boolean(event.targeted),
                  },
            );
            if (total === 0) {
              setError("No content sections detected (only header / footer).");
            }
          } else if (event.type === "section-analyzing") {
            const idx = Number(event.index);
            setProgress((p) => {
              if (!p) return p;
              const pos = p.indices.indexOf(idx);
              if (pos < 0) return p;
              return {
                ...p,
                current: pos + 1,
                phase: "analyzing",
                statuses: p.statuses.map((s, i) => (i === pos ? "running" : s)),
              };
            });
          } else if (event.type === "section-generating") {
            setProgress((p) => (p ? { ...p, phase: "generating" } : p));
          } else if (event.type === "section-replacing") {
            setProgress((p) => (p ? { ...p, phase: "replacing" } : p));
          } else if (event.type === "section-complete") {
            const idx = Number(event.index);
            lastSectionFinished = idx;
            // Append this section's diffs to the in-flight run.
            const heading = typeof event.heading === "string" ? event.heading : null;
            const replacements = Array.isArray(event.replacements)
              ? (event.replacements as RewriteReplacement[]).filter(
                  (r) => r && typeof r.before === "string" && typeof r.text === "string",
                )
              : [];
            setSummary((all) => {
              if (all.length === 0) return all;
              const last = all[all.length - 1];
              const next: RewriteRun = {
                ...last,
                sections: [...last.sections, { index: idx, heading, replacements }],
              };
              return [...all.slice(0, -1), next];
            });
            setProgress((p) => {
              if (!p) return p;
              const pos = p.indices.indexOf(idx);
              if (pos < 0) return p;
              return {
                ...p,
                phase: "idle",
                statuses: p.statuses.map((s, i) => (i === pos ? "done" : s)),
              };
            });
            // Apply text changes live in the iframe via postMessage — no
            // reload, so user state (scroll, opened tabs, expanded
            // accordions) is preserved.
            const win = iframeRef.current?.contentWindow;
            if (win && Array.isArray(event.replacements) && typeof event.selector === "string") {
              win.postMessage(
                {
                  type: "seo-mgr-apply",
                  selector: event.selector,
                  items: event.replacements,
                },
                "*",
              );
            }
          } else if (event.type === "section-error") {
            const idx = Number(event.index);
            setProgress((p) => {
              if (!p) return p;
              const pos = p.indices.indexOf(idx);
              if (pos < 0) return p;
              return {
                ...p,
                statuses: p.statuses.map((s, i) => (i === pos ? "error" : s)),
              };
            });
          } else if (event.type === "done") {
            const total = Number(event.total ?? 0);
            if (total === 0) {
              setError("No content sections detected (only header / footer).");
            } else {
              setSuccess(`Done. ${lastSectionFinished + 1}/${total} section${total === 1 ? "" : "s"} updated.`);
              setTimeout(() => setSuccess(null), 2400);
              setHistory((h) => [text, ...h].slice(0, 10));
              setPrompt("");
            }
          }
        }
      }
    } catch {
      setError("Network problem — please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Top metadata strip */}
      <div className="border-b border-hairline bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-baseline justify-between gap-4 px-6 py-4 lg:px-12">
          <div className="min-w-0 flex-1">
            <Link href="/" className="swiss-eyebrow text-muted hover:text-foreground">
              ← New capture
            </Link>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="swiss-eyebrow text-muted">— Rewrite</span>
              <h1 className="truncate text-base font-medium">{record.title ?? record.url}</h1>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs swiss-num">
            <Stat label="Source" value={record.url} mono="url" />
            <Stat label="Size" value={formatBytes(record.byteSize)} />
            <DownloadRewriteSummaryButton
              pageId={record.id}
              url={record.url}
              pageTitle={record.title}
              runs={summary}
            />
            <button
              type="button"
              onClick={() => setResearchOpen(true)}
              className="border border-hairline px-3 py-1.5 text-xs hover:border-foreground"
              title="Research and generate SEO content from competitor URLs"
            >
              ⌕ Research
            </button>
            <button
              type="button"
              onClick={() => {
                setIframeLoading(true);
                setIframeKey((k) => k + 1);
              }}
              className="border border-hairline px-3 py-1.5 text-xs hover:border-foreground"
              title="Reload preview"
            >
              ↻ Reload
            </button>
          </div>
        </div>
      </div>

      {/* Captured page render — fills the remaining viewport */}
      <div className="relative flex-1">
        <iframe
          key={iframeKey}
          ref={iframeRef}
          src={previewUrl}
          title={record.title ?? "Captured page"}
          // allow-scripts so tabs / accordions / carousels work. We
          // intentionally omit allow-same-origin so captured scripts run in
          // a unique sandboxed origin and can't read our session cookies.
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms"
          referrerPolicy="no-referrer"
          allow="autoplay; fullscreen; clipboard-read; clipboard-write"
          onLoad={() => setIframeLoading(false)}
          className="absolute inset-0 h-full w-full bg-white"
        />
        {iframeLoading && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <div className="flex items-center gap-3 border border-foreground bg-background/85 px-5 py-3 text-sm backdrop-blur-md">
              <span className="inline-block h-2 w-2 animate-pulse bg-accent" />
              <span>Loading preview…</span>
            </div>
          </div>
        )}
        {loading && progress && (
          <div className="pointer-events-none absolute right-6 top-6 max-w-xs border border-foreground bg-background/95 p-4 text-xs backdrop-blur">
            <div className="flex items-baseline justify-between gap-3">
              <span className="swiss-eyebrow text-muted">
                {progress.targeted ? "Targeted sections" : "Rewriting sections"}
              </span>
              <span className="font-mono swiss-num">
                {progress.statuses.filter((s) => s === "done").length}/{progress.total}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted">
              Header & footer skipped. {phaseLabel(progress.phase, progress.current)}
            </p>
            <ul className="mt-3 grid gap-1">
              {progress.statuses.map((s, i) => (
                <li key={i} className="flex items-center gap-2">
                  <SectionDot status={s} />
                  <span className="font-mono text-[11px] swiss-num">
                    @section{progress.indices[i] + 1}
                  </span>
                  <span className="text-[11px] capitalize text-muted">
                    {s === "running"
                      ? phaseShort(progress.phase)
                      : s}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Mac-Dock floating prompt — always visible, centered */}
      <Dock
        prompt={prompt}
        setPrompt={setPrompt}
        onSubmit={submit}
        loading={loading}
        error={error}
        success={success}
        history={history}
        inputRef={inputRef}
        progress={progress}
      />

      {/* Research + generation drawer */}
      <GeneratePanel
        open={researchOpen}
        onClose={() => setResearchOpen(false)}
        defaultKeyword={record.title ?? undefined}
        defaultSeedUrl={record.url}
        onUseAsPrompt={(markdown) => {
          setPrompt(
            `Use the following research-grounded markdown as source material to update the page sections. Match the page's existing tone and section boundaries. Do not paste raw markdown verbatim — adapt it.\n\n${markdown}`,
          );
          setResearchOpen(false);
          inputRef.current?.focus();
        }}
      />
    </div>
  );
}

type Phase = "preparing" | "analyzing" | "generating" | "replacing" | "idle";

function phaseShort(phase: Phase): string {
  if (phase === "analyzing") return "analyzing";
  if (phase === "generating") return "generating";
  if (phase === "replacing") return "replacing";
  if (phase === "preparing") return "preparing";
  return "running";
}

function phaseLabel(phase: Phase, current: number): string {
  if (phase === "preparing") return "Capturing page snapshot…";
  if (phase === "analyzing") return `Section ${current}: analyzing design.`;
  if (phase === "generating") return `Section ${current}: generating replacement.`;
  if (phase === "replacing") return `Section ${current}: applying changes.`;
  return "";
}

function SectionDot({ status }: { status: "pending" | "running" | "done" | "error" }) {
  const cls =
    status === "done"
      ? "bg-emerald-600"
      : status === "running"
      ? "bg-amber-500 animate-pulse"
      : status === "error"
      ? "bg-accent"
      : "bg-hairline";
  return <span className={`inline-block h-2 w-2 ${cls}`} />;
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: "url" | undefined }) {
  return (
    <div className="hidden flex-col gap-0.5 sm:flex">
      <span className="swiss-eyebrow text-muted">{label}</span>
      <span className={`max-w-[260px] truncate text-foreground ${mono === "url" ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function Dock({
  prompt,
  setPrompt,
  onSubmit,
  loading,
  error,
  success,
  history,
  inputRef,
  progress,
}: {
  prompt: string;
  setPrompt: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string | null;
  success: string | null;
  history: string[];
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  progress: { total: number; current: number; phase: Phase; statuses: ("pending" | "running" | "done" | "error")[] } | null;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div className="dock pointer-events-auto flex w-full max-w-2xl flex-col gap-2">
        {progress && loading && (
          <div className="dock-progress mx-auto flex items-center gap-2 px-3 py-1.5 text-[11px] text-white/80">
            <span className="swiss-eyebrow text-white/60">
              {progress.phase === "preparing"
                ? "Preparing"
                : `Section ${progress.current}/${progress.total} · ${phaseShort(progress.phase)}`}
            </span>
            <span className="flex items-center gap-1">
              {progress.statuses.map((s, i) => (
                <span
                  key={i}
                  className={`inline-block h-1.5 w-3 ${
                    s === "done"
                      ? "bg-emerald-400"
                      : s === "running"
                      ? "bg-amber-400 animate-pulse"
                      : s === "error"
                      ? "bg-rose-400"
                      : "bg-white/15"
                  }`}
                />
              ))}
            </span>
          </div>
        )}

        {(error || success) && (
          <div
            className={`mx-auto inline-flex items-center gap-2 px-3 py-1.5 text-xs backdrop-blur-xl ${
              error
                ? "border border-accent bg-accent/10 text-accent"
                : "border border-emerald-700/40 bg-emerald-700/10 text-emerald-700 dark:text-emerald-300"
            }`}
          >
            {error ?? success}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!loading) onSubmit();
          }}
          className="dock-bar flex items-end gap-2 px-3 py-3"
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 160) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!loading && prompt.trim()) onSubmit();
              }
            }}
            placeholder='Describe the rewrite — e.g. "Make the hero copy more concise" or "@section3 translate to French"'
            disabled={loading}
            className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || prompt.trim().length === 0}
            className="dock-btn shrink-0 px-4 py-2 text-sm font-medium tracking-wide transition-opacity disabled:opacity-40"
          >
            {loading ? "…" : "Apply ↵"}
          </button>
        </form>

        {history.length > 0 && (
          <div className="dock-history flex flex-wrap gap-1 px-3 py-2 text-[11px]">
            <span className="swiss-eyebrow text-white/50">Recent</span>
            {history.slice(0, 4).map((h, i) => (
              <button
                key={i}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setPrompt(h)}
                className="max-w-[220px] truncate bg-white/5 px-2 py-0.5 text-white/80 hover:bg-white/15"
                title={h}
              >
                {h}
              </button>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .dock-bar {
          background: rgba(15, 15, 15, 0.78);
          backdrop-filter: saturate(180%) blur(28px);
          -webkit-backdrop-filter: saturate(180%) blur(28px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow:
            0 24px 48px -12px rgba(0, 0, 0, 0.45),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
          border-radius: 18px !important;
        }
        .dock-history {
          background: rgba(15, 15, 15, 0.55);
          backdrop-filter: saturate(180%) blur(20px);
          -webkit-backdrop-filter: saturate(180%) blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px !important;
        }
        .dock-progress {
          background: rgba(15, 15, 15, 0.7);
          backdrop-filter: saturate(180%) blur(20px);
          -webkit-backdrop-filter: saturate(180%) blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px !important;
        }
        .dock-btn {
          background: #ffffff;
          color: #0a0a0a;
          border-radius: 12px !important;
        }
        .dock-btn:hover:not(:disabled) {
          opacity: 0.85;
        }
      `}</style>
    </div>
  );
}
