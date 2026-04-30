"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function DeleteActivityButton({
  kind,
  id,
  url,
}: {
  kind: "audit" | "rewrite";
  id: string;
  url: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Portal target gate — document.body isn't defined during SSR.
  useEffect(() => {
    setMounted(true);
  }, []);

  // ESC closes the modal; lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loading]);

  function close() {
    setOpen(false);
    setError(null);
  }

  async function remove() {
    setLoading(true);
    setError(null);
    try {
      const endpoint =
        kind === "audit" ? `/api/seo/audits/${id}` : `/api/seo/rewrite/${id}/delete`;
      const res = await fetch(endpoint, {
        method: kind === "audit" ? "DELETE" : "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Delete failed");
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Delete ${kind} for ${url}`}
        className="text-muted hover:text-accent"
        title="Delete"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" aria-hidden>
          <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
        </svg>
      </button>

      {mounted && open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-activity-title"
            aria-describedby="delete-activity-desc"
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          >
            {/* Backdrop */}
            <button
              type="button"
              aria-label="Close"
              tabIndex={-1}
              onClick={() => !loading && close()}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />

            {/* Dialog body */}
            <div className="relative flex w-full max-w-md flex-col gap-5 border border-foreground bg-background p-6 shadow-2xl">
              <div className="flex items-baseline justify-between gap-3 border-b border-hairline pb-3">
                <span className="swiss-eyebrow text-muted">— Confirm</span>
                <span className="swiss-eyebrow text-muted">{kind.toUpperCase()}</span>
              </div>

              <div className="flex flex-col gap-2">
                <h2 id="delete-activity-title" className="text-2xl font-medium tracking-tight">
                  Delete this {kind}?
                </h2>
                <p id="delete-activity-desc" className="text-sm text-muted">
                  This permanently removes the {kind === "audit" ? "audit report" : "captured page"}{" "}
                  and any stored data. This action cannot be undone.
                </p>
                <div className="mt-2 border border-hairline bg-zinc-50/70 px-3 py-2 text-xs backdrop-blur-sm dark:bg-zinc-900/60">
                  <div className="swiss-eyebrow text-muted">URL</div>
                  <div className="mt-1 break-all font-mono">{url}</div>
                </div>
              </div>

              {error && (
                <div className="border border-accent px-3 py-2 text-xs text-accent">{error}</div>
              )}

              <div className="flex flex-col-reverse gap-2 border-t border-hairline pt-4 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  onClick={close}
                  disabled={loading}
                  className="border border-hairline px-5 py-2.5 text-sm font-medium hover:border-foreground disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={remove}
                  disabled={loading}
                  autoFocus
                  className="bg-accent px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-50"
                >
                  {loading ? "Deleting…" : "Delete →"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
