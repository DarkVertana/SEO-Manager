"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  ContentSummary,
  GenerateOutputType,
  SourceMeta,
  ThemeAnalysis,
} from "@/lib/seo/generator/types";

type Phase = "idle" | "scraping" | "chunking" | "embedding" | "themes" | "generating" | "done";

type State = {
  phase: Phase;
  scrapedCount: number;
  totalUrls: number;
  scrapedSources: { url: string; title: string | null; length: number }[];
  scrapeErrors: { url: string; error: string }[];
  chunkCount: number;
  embeddingCount: number;
  themes: ThemeAnalysis[];
  summary: ContentSummary | null;
  sources: SourceMeta[];
  markdown: string;
  error: string | null;
};

const INITIAL_STATE: State = {
  phase: "idle",
  scrapedCount: 0,
  totalUrls: 0,
  scrapedSources: [],
  scrapeErrors: [],
  chunkCount: 0,
  embeddingCount: 0,
  themes: [],
  summary: null,
  sources: [],
  markdown: "",
  error: null,
};

export default function GeneratePanel({
  open,
  onClose,
  defaultKeyword,
  defaultSeedUrl,
  onUseAsPrompt,
}: {
  open: boolean;
  onClose: () => void;
  defaultKeyword?: string;
  defaultSeedUrl?: string;
  onUseAsPrompt: (markdown: string) => void;
}) {
  const [keyword, setKeyword] = useState(defaultKeyword ?? "");
  const [urlsText, setUrlsText] = useState(defaultSeedUrl ?? "");
  const [outputType, setOutputType] = useState<GenerateOutputType>("outline");
  const [targetWordCount, setTargetWordCount] = useState(1500);
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<State>(INITIAL_STATE);
  const [mounted, setMounted] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Portal target gate so SSR doesn't try to mount before document.body
  // exists, plus body-scroll lock + ESC handler while the panel is up.
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, loading, onClose]);

  useEffect(() => {
    if (defaultKeyword && !keyword) setKeyword(defaultKeyword);
    if (defaultSeedUrl && !urlsText) setUrlsText(defaultSeedUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultKeyword, defaultSeedUrl]);

  async function run() {
    if (loading) return;
    setLoading(true);
    setState({ ...INITIAL_STATE, phase: "scraping" });

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/seo/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          keyword,
          urls: urlsText,
          outputType,
          targetWordCount,
        }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setState((s) => ({ ...s, phase: "idle", error: data.error ?? "Request failed" }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const chunk = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const dataLine = chunk.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          let event: { type: string; [k: string]: unknown };
          try { event = JSON.parse(dataLine.slice(6)); } catch { continue; }
          handleEvent(event, setState);
        }
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        setState((s) => ({ ...s, phase: "idle", error: "Cancelled." }));
      } else {
        setState((s) => ({
          ...s,
          phase: "idle",
          error: err instanceof Error ? err.message : "Network error",
        }));
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function cancel() {
    abortRef.current?.abort();
  }

  function copyMarkdown() {
    if (!state.markdown) return;
    navigator.clipboard.writeText(state.markdown).catch(() => null);
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Research and generate SEO content"
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
    >
      {/* Backdrop. Covers the dock (z-50) since this whole layer is z-[120]. */}
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={() => !loading && onClose()}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      {/* Centered modal */}
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden border border-foreground bg-background shadow-2xl">
        <header className="sticky top-0 z-10 flex items-baseline justify-between border-b border-hairline bg-background/95 px-4 py-4 backdrop-blur sm:px-6">
          <div>
            <span className="swiss-eyebrow text-muted">— Research & Generate</span>
            <h2 className="mt-1 text-2xl font-medium tracking-tight">SEO content</h2>
            <p className="mt-1 text-xs text-muted">
              Research pipeline · vector embeddings · cosine top-k themes
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-hairline px-3 py-1.5 text-xs hover:border-foreground"
          >
            ✕ Close
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 sm:px-6">
          {/* Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run();
            }}
            className="flex flex-col gap-4"
          >
            <label className="flex flex-col gap-1">
              <span className="swiss-eyebrow text-muted">
                Keyword <span className="text-accent">*</span>
              </span>
              <input
                type="text"
                required
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="e.g. artificial intelligence in healthcare"
                className="border-0 border-b border-hairline bg-transparent py-2 text-base outline-none focus:border-foreground"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="swiss-eyebrow text-muted">
                Source URLs <span className="text-accent">*</span>{" "}
                <span className="text-muted">(one per line, max 20)</span>
              </span>
              <textarea
                required
                rows={5}
                value={urlsText}
                onChange={(e) => setUrlsText(e.target.value)}
                placeholder={"https://example.com/article-1\nhttps://example.com/article-2"}
                className="border border-hairline bg-transparent px-3 py-2 font-mono text-xs outline-none focus:border-foreground"
              />
              <span className="text-[11px] text-muted">
                Paste competitor or research URLs. Pages must be publicly
                accessible (we fetch them directly).
              </span>
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className="swiss-eyebrow text-muted">Output type</span>
                <div className="flex gap-0 border-b border-hairline">
                  {(["outline", "article"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setOutputType(t)}
                      className={`px-0 pr-6 pb-2 text-sm font-medium transition-colors ${
                        outputType === t
                          ? "border-b-2 border-foreground -mb-px"
                          : "text-muted hover:text-foreground"
                      }`}
                    >
                      {t === "outline" ? "Outline" : "Full article"}
                    </button>
                  ))}
                </div>
              </label>

              {outputType === "article" && (
                <label className="flex flex-col gap-1">
                  <span className="swiss-eyebrow text-muted">
                    Target words <span className="font-mono swiss-num">{targetWordCount}</span>
                  </span>
                  <input
                    type="range"
                    min={400}
                    max={3000}
                    step={100}
                    value={targetWordCount}
                    onChange={(e) => setTargetWordCount(Number(e.target.value))}
                    className="accent-foreground"
                  />
                </label>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={loading || !keyword.trim() || !urlsText.trim()}
                className="bg-foreground px-5 py-2.5 text-sm font-medium text-background disabled:opacity-40"
              >
                {loading ? "Researching…" : "Run pipeline →"}
              </button>
              {loading && (
                <button
                  type="button"
                  onClick={cancel}
                  className="border border-hairline px-3 py-2 text-xs hover:border-foreground"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          {/* Progress */}
          {(loading || state.phase !== "idle") && state.phase !== "done" && (
            <ProgressTrack state={state} loading={loading} />
          )}

          {/* Errors */}
          {state.error && (
            <div className="border border-accent bg-accent/5 px-4 py-3 text-sm text-accent">
              {state.error}
            </div>
          )}
          {state.scrapeErrors.length > 0 && (
            <details className="border border-amber-600 bg-amber-600/5 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
              <summary className="cursor-pointer font-medium">
                {state.scrapeErrors.length} URL{state.scrapeErrors.length === 1 ? "" : "s"} failed to scrape
              </summary>
              <ul className="mt-2 space-y-1">
                {state.scrapeErrors.map((e, i) => (
                  <li key={i} className="font-mono">
                    {e.url} — {e.error}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* Research metrics */}
          {state.summary && (
            <section>
              <span className="swiss-eyebrow text-muted">— Research metrics</span>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Sources" value={String(state.summary.totalSources)} />
                <Metric label="Chunks" value={String(state.summary.totalChunks)} />
                <Metric label="Total words" value={String(state.summary.totalWords)} />
                <Metric label="Avg chunk" value={`${state.summary.avgChunkLength}w`} />
              </div>
            </section>
          )}

          {/* Themes */}
          {state.themes.length > 0 && (
            <details className="border border-hairline">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium hover:bg-hairline/30">
                Key themes ({state.themes.length})
              </summary>
              <ul className="divide-y divide-hairline border-t border-hairline">
                {state.themes.map((t, i) => (
                  <li key={i} className="px-4 py-3 text-xs">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">{t.term}</span>
                      <span className="text-muted swiss-num">
                        {t.relevantChunks} chunk{t.relevantChunks === 1 ? "" : "s"} ·{" "}
                        {t.sources.length} source{t.sources.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    {t.keyPassages[0] && (
                      <p className="mt-1 text-muted">{t.keyPassages[0]}</p>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* Generated markdown */}
          {state.markdown && (
            <section>
              <div className="flex items-baseline justify-between border-b border-hairline pb-2">
                <span className="swiss-eyebrow text-muted">— Generated content</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={copyMarkdown}
                    className="border border-hairline px-3 py-1.5 text-xs hover:border-foreground"
                  >
                    Copy markdown
                  </button>
                  <button
                    type="button"
                    onClick={() => onUseAsPrompt(state.markdown)}
                    className="bg-foreground px-3 py-1.5 text-xs text-background hover:opacity-85"
                  >
                    Use in rewrite prompt →
                  </button>
                </div>
              </div>
              <pre className="mt-3 max-h-[60vh] overflow-auto whitespace-pre-wrap break-words border border-hairline bg-zinc-50/70 p-4 text-xs leading-relaxed backdrop-blur-sm dark:bg-zinc-900/60">
                {state.markdown}
              </pre>
            </section>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ProgressTrack({ state, loading }: { state: State; loading: boolean }) {
  const steps: { phase: Phase; label: string; detail: string }[] = [
    {
      phase: "scraping",
      label: "Scrape",
      detail:
        state.totalUrls > 0
          ? `${state.scrapedCount}/${state.totalUrls} sources fetched`
          : "Fetching sources…",
    },
    {
      phase: "chunking",
      label: "Chunk",
      detail: state.chunkCount > 0 ? `${state.chunkCount} chunks` : "Splitting text…",
    },
    {
      phase: "embedding",
      label: "Embed",
      detail:
        state.embeddingCount > 0
          ? `${state.embeddingCount} vectors generated`
          : "Calling embedding API…",
    },
    {
      phase: "themes",
      label: "Theme",
      detail:
        state.themes.length > 0
          ? `${state.themes.length} terms · top-k cosine search`
          : "Cosine top-k …",
    },
    {
      phase: "generating",
      label: "Generate",
      detail: "Writing markdown…",
    },
  ];
  const order: Phase[] = ["scraping", "chunking", "embedding", "themes", "generating", "done"];
  const currentIdx = order.indexOf(state.phase);
  return (
    <ul className="grid grid-cols-1 gap-2">
      {steps.map((s, i) => {
        const status =
          state.phase === "done" || currentIdx > order.indexOf(s.phase)
            ? "done"
            : currentIdx === order.indexOf(s.phase) && loading
              ? "running"
              : currentIdx === order.indexOf(s.phase) && !loading
                ? "running"
                : "pending";
        return (
          <li key={i} className="flex items-start gap-3 border-l-2 pl-3 py-1"
              style={{ borderColor: status === "done" ? "rgb(5,150,105)" : status === "running" ? "rgb(217,119,6)" : "var(--hairline)" }}>
            <span className="font-mono text-[11px] text-muted swiss-num">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="flex-1">
              <div className="text-sm font-medium">{s.label}</div>
              <div className="text-[11px] text-muted">{s.detail}</div>
            </div>
            <span
              className={`mt-1 inline-block h-2 w-2 ${
                status === "done"
                  ? "bg-emerald-600"
                  : status === "running"
                    ? "bg-amber-500 animate-pulse"
                    : "bg-hairline"
              }`}
            />
          </li>
        );
      })}
    </ul>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-hairline p-3">
      <div className="swiss-eyebrow text-muted">{label}</div>
      <div className="mt-1 font-mono text-xl swiss-num">{value}</div>
    </div>
  );
}

function handleEvent(
  event: { type: string; [k: string]: unknown },
  setState: React.Dispatch<React.SetStateAction<State>>,
) {
  switch (event.type) {
    case "scraping":
      setState((s) => ({ ...s, phase: "scraping", totalUrls: Number(event.total ?? 0) }));
      break;
    case "scraped":
      setState((s) => ({
        ...s,
        scrapedCount: Number(event.index ?? s.scrapedCount + 1),
        scrapedSources: [
          ...s.scrapedSources,
          {
            url: String(event.url ?? ""),
            title: typeof event.title === "string" ? event.title : null,
            length: Number(event.length ?? 0),
          },
        ],
      }));
      break;
    case "scrape-error":
      setState((s) => ({
        ...s,
        scrapeErrors: [...s.scrapeErrors, { url: String(event.url ?? ""), error: String(event.error ?? "") }],
      }));
      break;
    case "chunked":
      setState((s) => ({ ...s, phase: "chunking", chunkCount: Number(event.count ?? 0) }));
      // small delay so the Chunk row is visibly active before flipping to Embed
      setTimeout(() => setState((s2) => ({ ...s2, phase: "embedding", embeddingCount: Number(event.count ?? 0) })), 0);
      break;
    case "embedding":
      setState((s) => ({ ...s, phase: "embedding", embeddingCount: Number(event.count ?? 0) }));
      break;
    case "themes":
      setState((s) => ({
        ...s,
        phase: "themes",
        themes: (event.themes as ThemeAnalysis[]) ?? [],
        summary: (event.summary as ContentSummary) ?? null,
        sources: (event.sources as SourceMeta[]) ?? [],
      }));
      break;
    case "generating":
      setState((s) => ({ ...s, phase: "generating" }));
      break;
    case "done":
      setState((s) => ({ ...s, phase: "done", markdown: String(event.markdown ?? "") }));
      break;
    case "error":
      setState((s) => ({ ...s, phase: "idle", error: String(event.error ?? "Pipeline failed") }));
      break;
  }
}
