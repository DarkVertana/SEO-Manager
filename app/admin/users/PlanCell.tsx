"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { statusAccent, type SubscriptionStatus } from "@/lib/auth/plan";

const STATUS_OPTIONS: SubscriptionStatus[] = ["active", "trialing", "past_due", "canceled"];

export type PlanOption = {
  slug: string;
  name: string;
  monthlyPriceCents: number;
};

export default function PlanCell({
  userId,
  email,
  planSlug,
  status,
  currentPeriodEnd,
  plans,
}: {
  userId: string;
  email: string;
  planSlug: string;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  plans: PlanOption[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"plan" | "status" | "extend" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patch(payload: Record<string, unknown>, kind: "plan" | "status" | "extend") {
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/subscription`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(null);
    }
  }

  function changePlan(next: string) {
    if (next === planSlug) return;
    if (!confirm(`Move ${email} to "${next}" plan? This resets the billing cycle to 30 days from now.`)) return;
    patch({ planSlug: next }, "plan");
  }

  function changeStatus(next: SubscriptionStatus) {
    if (next === status) return;
    patch({ status: next }, "status");
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/* Plan select */}
      <select
        value={planSlug}
        onChange={(e) => changePlan(e.target.value)}
        disabled={busy !== null}
        aria-label="Plan"
        className="border border-hairline bg-transparent px-2 py-1 text-[11px] uppercase tracking-widest outline-none hover:border-foreground disabled:opacity-50"
      >
        {plans.map((p) => (
          <option key={p.slug} value={p.slug} className="text-foreground">
            {p.name}
          </option>
        ))}
      </select>

      {/* Status row + period end */}
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={status}
          onChange={(e) => changeStatus(e.target.value as SubscriptionStatus)}
          disabled={busy !== null}
          aria-label="Subscription status"
          className={`border border-hairline bg-transparent px-1.5 py-0.5 text-[10px] uppercase tracking-widest outline-none ${statusAccent(status)} disabled:opacity-50`}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s} className="text-foreground">
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
        <span className="font-mono text-[10px] text-muted swiss-num">
          ↻{" "}
          {currentPeriodEnd
            ? new Date(currentPeriodEnd).toLocaleDateString(undefined, { month: "short", day: "2-digit" })
            : "—"}
        </span>
        <button
          type="button"
          onClick={() => patch({ extend: true }, "extend")}
          disabled={busy !== null}
          className="text-[10px] uppercase tracking-widest text-muted underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
          title="Extend the current billing period by 30 days"
        >
          +30d
        </button>
      </div>

      {error && <span className="text-[10px] text-accent">{error}</span>}
    </div>
  );
}
