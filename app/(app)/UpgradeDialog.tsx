"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { formatBytes, formatPrice, planAccentByPrice } from "@/lib/auth/plan";

export type PlanCard = {
  slug: string;
  name: string;
  description: string | null;
  monthlyPriceCents: number;
  currency: string;
  auditsPerMonth: number;
  rewritesPerMonth: number;
  storageBytes: number;
  sourcesPerProgrammatic: number;
  features: string[];
  sortOrder: number;
};

// Controllable upgrade modal. Used both by the profile-page Upgrade button and
// by the home-page form when the API returns 402 (quota exhausted). Caller
// passes `open` + `onClose`; we just render the popup body.
export default function UpgradeDialog({
  open,
  onClose,
  currentSlug,
  plans,
  eyebrow = "— Choose your plan",
  headline = "Upgrade.",
  blurb,
}: {
  open: boolean;
  onClose: () => void;
  currentSlug: string;
  plans: PlanCard[];
  eyebrow?: string;
  headline?: string;
  blurb?: string;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && busySlug === null) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, busySlug]);

  // Reset transient messages whenever the dialog opens fresh.
  useEffect(() => {
    if (open) {
      setError(null);
      setSuccess(null);
    }
  }, [open]);

  const topSortOrder = plans.reduce(
    (m, p) => Math.max(m, p.sortOrder),
    plans[0]?.sortOrder ?? 0,
  );

  async function switchTo(slug: string) {
    if (slug === currentSlug) return;
    setBusySlug(slug);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/profile/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planSlug: slug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      setSuccess(`Switched to ${plans.find((p) => p.slug === slug)?.name ?? slug}.`);
      router.refresh();
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusySlug(null);
    }
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Upgrade plan"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={() => busySlug === null && onClose()}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden border border-foreground bg-background shadow-2xl">
        <header className="flex items-baseline justify-between gap-4 border-b border-hairline px-6 py-4">
          <div className="min-w-0">
            <span className="swiss-eyebrow text-muted">{eyebrow}</span>
            <h2 className="mt-1 text-2xl font-medium tracking-tight">{headline}</h2>
            {blurb && <p className="mt-2 text-xs text-muted">{blurb}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busySlug !== null}
            className="border border-hairline px-3 py-1.5 text-xs hover:border-foreground disabled:opacity-50"
          >
            ✕ Close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {success && (
            <div className="mb-4 border border-emerald-700/40 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
              {success}
            </div>
          )}
          {error && (
            <div className="mb-4 border border-accent px-3 py-2 text-xs text-accent">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {plans.map((p) => {
              const isCurrent = p.slug === currentSlug;
              const isTop = p.sortOrder === topSortOrder;
              return (
                <article
                  key={p.slug}
                  className={`flex flex-col gap-4 border p-5 ${
                    isCurrent ? "border-foreground" : "border-hairline"
                  }`}
                >
                  <div className="flex items-baseline justify-between">
                    <span
                      className={`px-2 py-0.5 text-[10px] tracking-widest ${planAccentByPrice(
                        p.monthlyPriceCents,
                        isTop,
                      )}`}
                    >
                      {p.slug.toUpperCase()}
                    </span>
                    {isCurrent && (
                      <span className="swiss-eyebrow text-[10px] text-muted">CURRENT</span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-2xl font-medium tracking-tight">{p.name}</h3>
                    {p.description && (
                      <p className="mt-1 text-xs text-muted">{p.description}</p>
                    )}
                  </div>
                  <div className="font-mono text-3xl swiss-num">
                    {formatPrice(p.monthlyPriceCents, p.currency)}
                    {p.monthlyPriceCents > 0 && (
                      <span className="text-xs text-muted"> / month</span>
                    )}
                  </div>

                  <ul className="flex flex-col gap-1 border-t border-hairline pt-3 text-xs">
                    <Limit label="Audits / mo" value={p.auditsPerMonth.toLocaleString()} />
                    <Limit label="Rewrites / mo" value={p.rewritesPerMonth.toLocaleString()} />
                    <Limit label="Storage" value={formatBytes(p.storageBytes)} />
                    <Limit label="Sources / pSEO" value={p.sourcesPerProgrammatic.toLocaleString()} />
                  </ul>

                  {p.features.length > 0 && (
                    <ul className="flex flex-col gap-1 border-t border-hairline pt-3">
                      {p.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-xs text-muted">
                          <span className="mt-1 h-1 w-1 shrink-0 bg-foreground" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <button
                    type="button"
                    onClick={() => switchTo(p.slug)}
                    disabled={isCurrent || busySlug !== null}
                    className={`mt-auto px-4 py-2.5 text-sm font-medium tracking-wide transition-opacity ${
                      isCurrent
                        ? "border border-hairline text-muted"
                        : isTop
                          ? "bg-foreground text-background hover:opacity-85"
                          : "bg-accent text-white hover:opacity-85"
                    } disabled:opacity-50`}
                  >
                    {busySlug === p.slug
                      ? "Switching…"
                      : isCurrent
                        ? "Current plan"
                        : `Switch to ${p.name} →`}
                  </button>
                </article>
              );
            })}
          </div>

          <p className="mt-6 text-center text-[11px] text-muted">
            Switching resets your billing cycle to a fresh 30-day window. No proration.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Limit({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-baseline justify-between gap-2">
      <span className="swiss-eyebrow text-muted">{label}</span>
      <span className="font-mono text-foreground swiss-num">{value}</span>
    </li>
  );
}
