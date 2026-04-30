"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PLAN_SLUG_REGEX } from "@/lib/auth/plan";

export default function NewPlanButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [priceDollars, setPriceDollars] = useState("0");
  const [audits, setAudits] = useState(100);
  const [rewrites, setRewrites] = useState(25);
  const [storageGB, setStorageGB] = useState("1");
  const [sources, setSources] = useState(20);
  const [features, setFeatures] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [description, setDescription] = useState("");

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, busy]);

  function close() {
    setOpen(false);
    setError(null);
  }

  function reset() {
    setSlug("");
    setName("");
    setPriceDollars("0");
    setAudits(100);
    setRewrites(25);
    setStorageGB("1");
    setSources(20);
    setFeatures("");
    setSortOrder(0);
    setDescription("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!PLAN_SLUG_REGEX.test(slug)) {
      setError("Slug must be lowercase letters/digits/hyphens (2–32 chars)");
      return;
    }
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          name,
          description,
          monthlyPriceCents: Math.round(parseFloat(priceDollars || "0") * 100),
          auditsPerMonth: audits,
          rewritesPerMonth: rewrites,
          storageBytes: Math.round(parseFloat(storageGB || "0") * 1_000_000_000),
          sourcesPerProgrammatic: sources,
          features: features.split("\n").map((f) => f.trim()).filter(Boolean),
          sortOrder,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-foreground px-4 py-2 text-xs text-background hover:opacity-85"
      >
        + New plan
      </button>

      {mounted && open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Create plan"
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          >
            <button
              type="button"
              aria-label="Close"
              tabIndex={-1}
              onClick={() => !busy && close()}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <form
              onSubmit={submit}
              className="relative flex w-full max-w-2xl flex-col gap-4 border border-foreground bg-background p-6 shadow-2xl"
            >
              <div className="flex items-baseline justify-between border-b border-hairline pb-3">
                <span className="swiss-eyebrow text-muted">— New plan</span>
                <button
                  type="button"
                  onClick={close}
                  disabled={busy}
                  className="swiss-eyebrow text-muted hover:text-foreground"
                >
                  ✕ Close
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Slug *" hint="lowercase, hyphens only">
                  <input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase())}
                    placeholder="growth"
                    required
                    className="border-0 border-b border-hairline bg-transparent py-1.5 font-mono text-base outline-none focus:border-foreground"
                  />
                </Field>
                <Field label="Name *">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Growth"
                    required
                    className="border-0 border-b border-hairline bg-transparent py-1.5 text-base outline-none focus:border-foreground"
                  />
                </Field>
                <Field label="Description">
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional"
                    className="border-0 border-b border-hairline bg-transparent py-1.5 text-base outline-none focus:border-foreground"
                  />
                </Field>
                <Field label="Monthly price (USD)">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={priceDollars}
                    onChange={(e) => setPriceDollars(e.target.value)}
                    className="border-0 border-b border-hairline bg-transparent py-1.5 font-mono text-base swiss-num outline-none focus:border-foreground"
                  />
                </Field>
                <Field label="Audits / month">
                  <input
                    type="number"
                    min="0"
                    value={audits}
                    onChange={(e) => setAudits(Number(e.target.value) || 0)}
                    className="border-0 border-b border-hairline bg-transparent py-1.5 font-mono text-base swiss-num outline-none focus:border-foreground"
                  />
                </Field>
                <Field label="Rewrites / month">
                  <input
                    type="number"
                    min="0"
                    value={rewrites}
                    onChange={(e) => setRewrites(Number(e.target.value) || 0)}
                    className="border-0 border-b border-hairline bg-transparent py-1.5 font-mono text-base swiss-num outline-none focus:border-foreground"
                  />
                </Field>
                <Field label="Storage (GB)">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={storageGB}
                    onChange={(e) => setStorageGB(e.target.value)}
                    className="border-0 border-b border-hairline bg-transparent py-1.5 font-mono text-base swiss-num outline-none focus:border-foreground"
                  />
                </Field>
                <Field label="Sources / programmatic">
                  <input
                    type="number"
                    min="0"
                    value={sources}
                    onChange={(e) => setSources(Number(e.target.value) || 0)}
                    className="border-0 border-b border-hairline bg-transparent py-1.5 font-mono text-base swiss-num outline-none focus:border-foreground"
                  />
                </Field>
                <Field label="Sort order">
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
                    className="border-0 border-b border-hairline bg-transparent py-1.5 font-mono text-base swiss-num outline-none focus:border-foreground"
                  />
                </Field>
              </div>

              <Field label="Features (one per line)">
                <textarea
                  value={features}
                  onChange={(e) => setFeatures(e.target.value)}
                  rows={5}
                  placeholder="Everything in Pro&#10;Custom integrations&#10;Dedicated support"
                  className="border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground"
                />
              </Field>

              {error && <div className="border border-accent px-3 py-2 text-xs text-accent">{error}</div>}

              <div className="flex flex-col-reverse gap-2 border-t border-hairline pt-4 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  onClick={close}
                  disabled={busy}
                  className="border border-hairline px-5 py-2.5 text-sm hover:border-foreground disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || !slug || !name}
                  className="bg-foreground px-5 py-2.5 text-sm text-background hover:opacity-85 disabled:opacity-50"
                >
                  {busy ? "Creating…" : "Create plan →"}
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}
    </>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="swiss-eyebrow text-muted">{label}</span>
      {children}
      {hint && <span className="text-[10px] text-muted">{hint}</span>}
    </label>
  );
}
