"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatBytes, formatPrice } from "@/lib/auth/plan";

export type PlanRowData = {
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
  isActive: boolean;
  isPublic: boolean;
  userCount: number;
};

export default function PlanRow({ plan }: { plan: PlanRowData }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable form state — kept here so edits don't lose focus on re-render.
  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description ?? "");
  const [priceDollars, setPriceDollars] = useState((plan.monthlyPriceCents / 100).toString());
  const [currency, setCurrency] = useState(plan.currency);
  const [audits, setAudits] = useState(plan.auditsPerMonth);
  const [rewrites, setRewrites] = useState(plan.rewritesPerMonth);
  const [storageGB, setStorageGB] = useState((plan.storageBytes / 1_000_000_000).toString());
  const [sources, setSources] = useState(plan.sourcesPerProgrammatic);
  const [features, setFeatures] = useState(plan.features.join("\n"));
  const [sortOrder, setSortOrder] = useState(plan.sortOrder);
  const [isActive, setIsActive] = useState(plan.isActive);
  const [isPublic, setIsPublic] = useState(plan.isPublic);

  function reset() {
    setName(plan.name);
    setDescription(plan.description ?? "");
    setPriceDollars((plan.monthlyPriceCents / 100).toString());
    setCurrency(plan.currency);
    setAudits(plan.auditsPerMonth);
    setRewrites(plan.rewritesPerMonth);
    setStorageGB((plan.storageBytes / 1_000_000_000).toString());
    setSources(plan.sourcesPerProgrammatic);
    setFeatures(plan.features.join("\n"));
    setSortOrder(plan.sortOrder);
    setIsActive(plan.isActive);
    setIsPublic(plan.isPublic);
    setError(null);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/plans/${plan.slug}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          monthlyPriceCents: Math.round(parseFloat(priceDollars || "0") * 100),
          currency,
          auditsPerMonth: audits,
          rewritesPerMonth: rewrites,
          storageBytes: Math.round(parseFloat(storageGB || "0") * 1_000_000_000),
          sourcesPerProgrammatic: sources,
          features: features.split("\n").map((f) => f.trim()).filter(Boolean),
          sortOrder,
          isActive,
          isPublic,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (plan.userCount > 0) {
      alert(`Cannot delete: ${plan.userCount} user(s) are on this plan. Move them first.`);
      return;
    }
    if (!confirm(`Permanently delete the "${plan.name}" plan?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/plans/${plan.slug}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="grid grid-cols-1 gap-x-6 gap-y-4 py-6 lg:grid-cols-12">
      {/* Identity */}
      <div className="lg:col-span-4">
        <div className="flex items-baseline gap-2">
          <code className="font-mono text-xs text-muted">{plan.slug}</code>
          {!plan.isActive && (
            <span className="border border-hairline px-1.5 py-0.5 text-[10px] tracking-widest text-muted">INACTIVE</span>
          )}
          {!plan.isPublic && (
            <span className="border border-hairline px-1.5 py-0.5 text-[10px] tracking-widest text-muted">PRIVATE</span>
          )}
        </div>
        {editing ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 w-full border-0 border-b border-hairline bg-transparent py-1.5 text-2xl font-medium tracking-tight outline-none focus:border-foreground"
          />
        ) : (
          <h2 className="mt-2 text-2xl font-medium tracking-tight">{plan.name}</h2>
        )}
        {editing ? (
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-2 w-full border border-hairline bg-transparent px-2 py-1 text-xs outline-none focus:border-foreground"
            placeholder="Optional description"
          />
        ) : (
          plan.description && <p className="mt-2 text-xs text-muted">{plan.description}</p>
        )}
        <div className="mt-3 flex items-baseline gap-3">
          {editing ? (
            <div className="flex items-baseline gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                value={priceDollars}
                onChange={(e) => setPriceDollars(e.target.value)}
                className="w-24 border-0 border-b border-hairline bg-transparent py-1 font-mono text-2xl swiss-num outline-none focus:border-foreground"
              />
              <input
                value={currency}
                maxLength={3}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                className="w-12 border-0 border-b border-hairline bg-transparent py-1 text-xs uppercase tracking-widest outline-none focus:border-foreground"
              />
              <span className="text-xs text-muted">/ month</span>
            </div>
          ) : (
            <div className="font-mono text-2xl swiss-num">
              {formatPrice(plan.monthlyPriceCents, plan.currency)}
              {plan.monthlyPriceCents > 0 && <span className="text-xs text-muted"> / month</span>}
            </div>
          )}
        </div>
        <div className="mt-3 text-[11px] text-muted">
          <span className="font-mono swiss-num">{plan.userCount}</span> user{plan.userCount === 1 ? "" : "s"} ·
          MRR <span className="font-mono swiss-num">{formatPrice(plan.monthlyPriceCents * plan.userCount, plan.currency)}</span>
        </div>
      </div>

      {/* Limits */}
      <div className="lg:col-span-5">
        <span className="swiss-eyebrow text-muted">Limits</span>
        {editing ? (
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <NumberField label="Audits / month" value={audits} onChange={setAudits} />
            <NumberField label="Rewrites / month" value={rewrites} onChange={setRewrites} />
            <div className="flex flex-col gap-1">
              <span className="swiss-eyebrow text-muted">Storage (GB)</span>
              <input
                type="number"
                step="0.1"
                min="0"
                value={storageGB}
                onChange={(e) => setStorageGB(e.target.value)}
                className="border-0 border-b border-hairline bg-transparent py-1 font-mono swiss-num outline-none focus:border-foreground"
              />
            </div>
            <NumberField label="Sources / programmatic" value={sources} onChange={setSources} />
            <NumberField label="Sort order" value={sortOrder} onChange={setSortOrder} />
          </div>
        ) : (
          <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <Limit label="Audits / mo" value={plan.auditsPerMonth.toLocaleString()} />
            <Limit label="Rewrites / mo" value={plan.rewritesPerMonth.toLocaleString()} />
            <Limit label="Storage" value={formatBytes(plan.storageBytes)} />
            <Limit label="Sources / pSEO" value={plan.sourcesPerProgrammatic.toLocaleString()} />
            <Limit label="Sort order" value={String(plan.sortOrder)} />
          </ul>
        )}

        <div className="mt-4">
          <span className="swiss-eyebrow text-muted">Features</span>
          {editing ? (
            <textarea
              value={features}
              onChange={(e) => setFeatures(e.target.value)}
              rows={6}
              placeholder="One feature per line"
              className="mt-1 w-full border border-hairline bg-transparent px-2 py-1 text-xs outline-none focus:border-foreground"
            />
          ) : (
            <ul className="mt-1 grid grid-cols-1 gap-y-0.5 sm:grid-cols-2">
              {plan.features.length === 0 ? (
                <li className="text-xs text-muted">—</li>
              ) : (
                plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-muted">
                    <span className="mt-1 h-1 w-1 shrink-0 bg-foreground" />
                    <span>{f}</span>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 lg:col-span-3 lg:items-end">
        {editing ? (
          <>
            <div className="flex flex-wrap gap-3 text-xs">
              <label className="inline-flex items-center gap-1">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Active
              </label>
              <label className="inline-flex items-center gap-1">
                <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /> Public
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="bg-foreground px-4 py-2 text-xs text-background disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save →"}
              </button>
              <button
                type="button"
                onClick={() => { reset(); setEditing(false); }}
                disabled={busy}
                className="border border-hairline px-3 py-2 text-xs hover:border-foreground disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="border border-hairline px-3 py-2 text-xs hover:border-foreground"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={busy || plan.userCount > 0}
              className="border border-hairline px-3 py-2 text-xs text-accent hover:border-accent disabled:opacity-50"
              title={plan.userCount > 0 ? `${plan.userCount} user(s) on this plan` : "Delete this plan"}
            >
              Delete
            </button>
          </div>
        )}
        {error && <span className="text-[10px] text-accent">{error}</span>}
      </div>
    </li>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="swiss-eyebrow text-muted">{label}</span>
      <input
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="border-0 border-b border-hairline bg-transparent py-1 font-mono swiss-num outline-none focus:border-foreground"
      />
    </div>
  );
}

function Limit({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-baseline justify-between gap-2 border-b border-hairline py-0.5">
      <span className="swiss-eyebrow text-muted">{label}</span>
      <span className="font-mono text-foreground swiss-num">{value}</span>
    </li>
  );
}
