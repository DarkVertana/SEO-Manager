import Link from "next/link";
import { db } from "@/lib/db";
import { formatAccountId } from "@/lib/auth/account-id";
import { formatPrice, statusAccent, type SubscriptionStatus } from "@/lib/auth/plan";
import PlanCell, { type PlanOption } from "../users/PlanCell";

type FilterParams = {
  plan?: string;
  status?: string;
  q?: string;
};

const STATUSES: SubscriptionStatus[] = ["active", "trialing", "past_due", "canceled"];

function daysFromNow(d: Date | null): number | null {
  if (!d) return null;
  return Math.round((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<FilterParams>;
}) {
  const sp = await searchParams;
  const filterPlan = (sp.plan ?? "").trim();
  const filterStatus = (sp.status ?? "").trim();
  const filterQuery = (sp.q ?? "").trim().toLowerCase();

  const [plansRaw, allUsers] = await Promise.all([
    db.plan.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        slug: true,
        name: true,
        monthlyPriceCents: true,
        currency: true,
        isActive: true,
      },
    }),
    db.user.findMany({
      orderBy: { currentPeriodEnd: "asc" },
      select: {
        id: true,
        email: true,
        accountNumber: true,
        planSlug: true,
        subscriptionStatus: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        plan: { select: { name: true, monthlyPriceCents: true, currency: true } },
      },
      take: 500,
    }),
  ]);

  // Apply filters in-memory; the query builder gets cleaner this way given the
  // fan-out is small (~500 users max).
  const filtered = allUsers.filter((u) => {
    if (filterPlan && u.planSlug !== filterPlan) return false;
    if (filterStatus && u.subscriptionStatus !== filterStatus) return false;
    if (filterQuery && !u.email.toLowerCase().includes(filterQuery)) return false;
    return true;
  });

  const planOptions: PlanOption[] = plansRaw
    .filter((p) => p.isActive)
    .map((p) => ({ slug: p.slug, name: p.name, monthlyPriceCents: p.monthlyPriceCents }));

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-10 px-4 py-10 sm:gap-12 sm:px-6 sm:py-12 lg:px-12">
      <section>
        <span className="swiss-eyebrow text-accent">— Admin · Subscriptions</span>
        <h1 className="mt-3 text-balance text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
          Subscriptions.
        </h1>
        <p className="mt-4 max-w-xl text-pretty text-sm leading-relaxed text-muted sm:mt-6 sm:text-base">
          Per-user billing cycles, status, and plan changes.
        </p>
      </section>

      {/* Filter bar */}
      <section>
        <form
          className="flex flex-wrap items-end gap-3 border-b border-hairline pb-3"
          method="get"
          action="/admin/subscriptions"
        >
          <label className="flex flex-col gap-1">
            <span className="swiss-eyebrow text-muted">Plan</span>
            <select
              name="plan"
              defaultValue={filterPlan}
              className="border border-hairline bg-transparent px-2 py-1.5 text-sm outline-none focus:border-foreground"
            >
              <option value="">All</option>
              {plansRaw.map((p) => (
                <option key={p.slug} value={p.slug}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="swiss-eyebrow text-muted">Status</span>
            <select
              name="status"
              defaultValue={filterStatus}
              className="border border-hairline bg-transparent px-2 py-1.5 text-sm outline-none focus:border-foreground"
            >
              <option value="">All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace("_", " ")}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="swiss-eyebrow text-muted">Email contains</span>
            <input
              type="text"
              name="q"
              defaultValue={filterQuery}
              placeholder="acme.com"
              className="border-0 border-b border-hairline bg-transparent px-1 py-1.5 text-sm outline-none focus:border-foreground"
            />
          </label>
          <button
            type="submit"
            className="bg-foreground px-3 py-1.5 text-xs text-background hover:opacity-85"
          >
            Filter →
          </button>
          {(filterPlan || filterStatus || filterQuery) && (
            <Link
              href="/admin/subscriptions"
              className="text-xs text-muted underline-offset-4 hover:text-foreground hover:underline"
            >
              Clear
            </Link>
          )}
          <span className="ml-auto text-xs text-muted swiss-num">
            {filtered.length} match{filtered.length === 1 ? "" : "es"}
          </span>
        </form>

        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[1000px] w-full text-left">
            <colgroup>
              <col className="w-[7.5rem]" />
              <col className="w-[20%] min-w-[12rem]" />
              <col className="w-32" />
              <col className="w-28" />
              <col className="w-32" />
              <col className="w-[20%] min-w-[15rem]" />
            </colgroup>
            <thead className="border-b border-hairline text-xs text-muted">
              <tr>
                <th className="py-3 pr-3 font-medium swiss-eyebrow">Account</th>
                <th className="py-3 pr-3 font-medium swiss-eyebrow">Email</th>
                <th className="py-3 pr-3 font-medium swiss-eyebrow">Plan</th>
                <th className="py-3 pr-3 font-medium swiss-eyebrow">Status</th>
                <th className="py-3 pr-3 font-medium swiss-eyebrow">Renews</th>
                <th className="py-3 pr-3 font-medium swiss-eyebrow">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-sm text-muted">
                    No subscriptions match the current filter.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => {
                  const days = daysFromNow(u.currentPeriodEnd);
                  const dueSoon = days !== null && days <= 7 && days >= 0;
                  const overdue = days !== null && days < 0;
                  return (
                    <tr key={u.id} className="text-sm">
                      <td className="py-4 pr-3 align-top font-mono text-xs">
                        {formatAccountId(u.accountNumber)}
                      </td>
                      <td className="py-4 pr-3 align-top">
                        <div className="truncate font-mono text-xs">{u.email}</div>
                        {u.cancelAtPeriodEnd && (
                          <div className="mt-1 text-[10px] text-amber-700 dark:text-amber-400">
                            cancels at period end
                          </div>
                        )}
                      </td>
                      <td className="py-4 pr-3 align-top">
                        <div className="text-xs font-medium">{u.plan.name}</div>
                        <div className="font-mono text-[11px] text-muted swiss-num">
                          {formatPrice(u.plan.monthlyPriceCents, u.plan.currency)}/mo
                        </div>
                      </td>
                      <td className="py-4 pr-3 align-top">
                        <span className={`text-xs uppercase tracking-widest ${statusAccent(u.subscriptionStatus)}`}>
                          {u.subscriptionStatus.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-4 pr-3 align-top text-xs swiss-num">
                        {u.currentPeriodEnd
                          ? new Date(u.currentPeriodEnd).toLocaleDateString(undefined, {
                              year: "2-digit", month: "short", day: "2-digit",
                            })
                          : "—"}
                        {days !== null && (
                          <div
                            className={`mt-0.5 text-[10px] ${
                              overdue ? "text-accent" : dueSoon ? "text-amber-700 dark:text-amber-400" : "text-muted"
                            }`}
                          >
                            {overdue ? `${Math.abs(days)}d overdue` : `${days}d`}
                          </div>
                        )}
                      </td>
                      <td className="py-4 pr-3 align-top">
                        <PlanCell
                          userId={u.id}
                          email={u.email}
                          planSlug={u.planSlug}
                          status={u.subscriptionStatus}
                          currentPeriodEnd={u.currentPeriodEnd ? u.currentPeriodEnd.toISOString() : null}
                          plans={planOptions}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
