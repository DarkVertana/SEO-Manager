import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/server";
import { formatAccountId } from "@/lib/auth/account-id";
import {
  bytesAsNumber,
  formatBytes,
  formatPrice,
  pct,
  planAccentByPrice,
  statusAccent,
} from "@/lib/auth/plan";
import ProfileForm from "./ProfileForm";
import UpgradePlanButton, { type PlanCard } from "./UpgradePlanButton";

const SCORE_BUCKETS = [
  { label: "Excellent", min: 80, max: 100, tone: "bg-emerald-600" },
  { label: "Fair", min: 60, max: 79, tone: "bg-amber-500" },
  { label: "Poor", min: 0, max: 59, tone: "bg-accent" },
] as const;

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function startOfWeek(d: Date): Date {
  const r = startOfDay(d);
  const dow = (r.getDay() + 6) % 7; // Monday-anchored week
  r.setDate(r.getDate() - dow);
  return r;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function safeHostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return url; }
}

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) return null;

  const now = new Date();
  const monthStart = startOfMonth(now);
  const weekStart = startOfWeek(now);
  const dayStart = startOfDay(now);

  const [
    user,
    availablePlansRaw,
    auditCount,
    rewriteCount,
    auditsThisMonth,
    auditsThisWeek,
    auditsToday,
    rewritesThisMonth,
    storageAgg,
    scoreAgg,
    topIndustriesRaw,
    recentAudits,
    recentRewrites,
    allAuditScores,
  ] = await Promise.all([
    db.user.findUnique({
      where: { id: session.uid },
      select: {
        id: true,
        accountNumber: true,
        email: true,
        name: true,
        createdAt: true,
        planSlug: true,
        subscriptionStatus: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        plan: {
          select: {
            slug: true,
            name: true,
            description: true,
            monthlyPriceCents: true,
            currency: true,
            auditsPerMonth: true,
            rewritesPerMonth: true,
            storageBytes: true,
            sourcesPerProgrammatic: true,
            features: true,
            sortOrder: true,
          },
        },
      },
    }),
    db.plan.findMany({
      where: { isActive: true, isPublic: true },
      orderBy: { sortOrder: "asc" },
      select: {
        slug: true,
        name: true,
        description: true,
        monthlyPriceCents: true,
        currency: true,
        auditsPerMonth: true,
        rewritesPerMonth: true,
        storageBytes: true,
        sourcesPerProgrammatic: true,
        features: true,
        sortOrder: true,
      },
    }),
    db.seoAnalysis.count({ where: { userId: session.uid } }),
    db.rewritePage.count({ where: { userId: session.uid } }),
    db.seoAnalysis.count({ where: { userId: session.uid, createdAt: { gte: monthStart } } }),
    db.seoAnalysis.count({ where: { userId: session.uid, createdAt: { gte: weekStart } } }),
    db.seoAnalysis.count({ where: { userId: session.uid, createdAt: { gte: dayStart } } }),
    db.rewritePage.count({ where: { userId: session.uid, createdAt: { gte: monthStart } } }),
    db.rewritePage.aggregate({
      where: { userId: session.uid },
      _sum: { byteSize: true },
    }),
    db.seoAnalysis.aggregate({
      where: { userId: session.uid },
      _avg: { overallScore: true },
      _max: { createdAt: true },
    }),
    db.seoAnalysis.groupBy({
      by: ["industry"],
      where: { userId: session.uid, industry: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { industry: "desc" } },
      take: 5,
    }),
    db.seoAnalysis.findMany({
      where: { userId: session.uid },
      orderBy: { createdAt: "desc" },
      select: { id: true, url: true, command: true, overallScore: true, createdAt: true },
      take: 5,
    }),
    db.rewritePage.findMany({
      where: { userId: session.uid },
      orderBy: { createdAt: "desc" },
      select: { id: true, url: true, byteSize: true, createdAt: true },
      take: 5,
    }),
    db.seoAnalysis.findMany({
      where: { userId: session.uid },
      select: { url: true, overallScore: true },
      take: 500,
    }),
  ]);

  if (!user) return null;

  const plan = user.plan;
  const availablePlans: PlanCard[] = availablePlansRaw.map((p) => ({
    slug: p.slug,
    name: p.name,
    description: p.description,
    monthlyPriceCents: p.monthlyPriceCents,
    currency: p.currency,
    auditsPerMonth: p.auditsPerMonth,
    rewritesPerMonth: p.rewritesPerMonth,
    storageBytes: bytesAsNumber(p.storageBytes),
    sourcesPerProgrammatic: p.sourcesPerProgrammatic,
    features: p.features,
    sortOrder: p.sortOrder,
  }));
  // Highest sortOrder = top tier; flag it so its badge gets the inverted style.
  const maxSortOrder = availablePlans.reduce(
    (m, p) => Math.max(m, p.sortOrder),
    plan.sortOrder,
  );
  const isTopTier = plan.sortOrder === maxSortOrder;

  // Top domains, computed in app code (Prisma can't groupBy on a derived
  // hostname without raw SQL).
  const domainTally = new Map<string, number>();
  for (const a of allAuditScores) {
    const h = safeHostname(a.url);
    domainTally.set(h, (domainTally.get(h) ?? 0) + 1);
  }
  const topDomains = [...domainTally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Score distribution buckets
  const buckets = SCORE_BUCKETS.map((b) => ({
    ...b,
    count: allAuditScores.filter((a) => a.overallScore >= b.min && a.overallScore <= b.max).length,
  }));
  const totalScored = allAuditScores.length;

  const storageUsed = storageAgg._sum.byteSize ?? 0;
  const avgScore = scoreAgg._avg.overallScore ?? null;
  const lastActive = scoreAgg._max.createdAt ?? user.createdAt;

  // Merge recent activity from both tables
  type Recent =
    | { kind: "audit"; id: string; url: string; command: string; score: number; createdAt: Date }
    | { kind: "rewrite"; id: string; url: string; createdAt: Date };
  const recent: Recent[] = [
    ...recentAudits.map((a): Recent => ({
      kind: "audit", id: a.id, url: a.url, command: a.command,
      score: a.overallScore, createdAt: a.createdAt,
    })),
    ...recentRewrites.map((r): Recent => ({
      kind: "rewrite", id: r.id, url: r.url, createdAt: r.createdAt,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-10 px-4 py-10 sm:gap-12 sm:px-6 sm:py-12 lg:gap-16 lg:px-12">
      {/* Header */}
      <section className="grid grid-cols-1 gap-y-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <span className="swiss-eyebrow text-muted">— Account</span>
          <h1 className="mt-3 text-balance text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Profile.
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-sm leading-relaxed text-muted sm:mt-6 sm:text-base">
            Account details, subscription, usage, and a snapshot of how you've
            been using the workspace.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-end sm:gap-3 lg:col-span-5">
          <Link
            href="/history"
            className="border border-hairline px-5 py-2.5 text-center text-sm font-medium hover:border-foreground"
          >
            View history →
          </Link>
          <Link
            href="/"
            className="bg-foreground px-5 py-2.5 text-center text-sm font-medium text-background transition-opacity hover:opacity-85"
          >
            Run a skill →
          </Link>
        </div>
      </section>

      {/* §01 Account */}
      <section>
        <span className="swiss-eyebrow text-muted">— 01 / Account</span>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Email" value={user.email} mono />
          <Stat label="Display name" value={user.name ?? "—"} />
          <Stat
            label="Member since"
            value={new Date(user.createdAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "2-digit",
            })}
          />
          <Stat label="Account ID" value={formatAccountId(user.accountNumber)} mono />
        </div>
      </section>

      {/* §02 Subscription Plan */}
      <section>
        <span className="swiss-eyebrow text-muted">— 02 / Subscription Plan</span>
        <div className="mt-4 border border-hairline">
          <div className="grid grid-cols-1 gap-y-6 border-b border-hairline p-6 lg:grid-cols-12 lg:gap-x-6">
            <div className="lg:col-span-5">
              <div className="flex items-baseline gap-2">
                <span className="swiss-eyebrow text-muted">Plan</span>
                <span
                  className={`px-2 py-0.5 text-[10px] tracking-widest ${planAccentByPrice(
                    plan.monthlyPriceCents,
                    isTopTier,
                  )}`}
                >
                  {plan.slug.toUpperCase()}
                </span>
              </div>
              <h2 className="mt-2 text-2xl font-medium tracking-tight sm:text-3xl">{plan.name}</h2>
              {plan.description && (
                <p className="mt-1 text-xs text-muted">{plan.description}</p>
              )}
              <div className="mt-2 font-mono text-2xl swiss-num">
                {formatPrice(plan.monthlyPriceCents, plan.currency)}
                {plan.monthlyPriceCents > 0 && <span className="text-xs text-muted"> / month</span>}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-hairline pt-4 text-xs">
                <div className="flex flex-col gap-0.5">
                  <span className="swiss-eyebrow text-muted">Status</span>
                  <span className={`font-medium ${statusAccent(user.subscriptionStatus)}`}>
                    {user.subscriptionStatus.replace("_", " ")}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="swiss-eyebrow text-muted">Renews</span>
                  <span className="font-mono swiss-num">
                    {user.currentPeriodEnd
                      ? new Date(user.currentPeriodEnd).toLocaleDateString(undefined, {
                          year: "numeric", month: "short", day: "2-digit",
                        })
                      : "—"}
                  </span>
                </div>
                {user.cancelAtPeriodEnd && (
                  <div className="col-span-2 border border-amber-600/40 px-2 py-1 text-[11px] text-amber-700 dark:text-amber-400">
                    Cancellation scheduled at period end.
                  </div>
                )}
              </div>
              <UpgradePlanButton
                currentSlug={user.planSlug}
                plans={availablePlans}
              />
            </div>
            <div className="lg:col-span-7">
              <span className="swiss-eyebrow text-muted">What's included</span>
              <ul className="mt-2 grid grid-cols-1 gap-y-1 sm:grid-cols-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-muted">
                    <span className="mt-1 h-1 w-1 shrink-0 bg-foreground" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 p-6 sm:grid-cols-2 lg:grid-cols-3">
            <UsageBar
              label="Audits this month"
              used={auditsThisMonth}
              limit={plan.auditsPerMonth}
              format={(v) => `${v}`}
            />
            <UsageBar
              label="Rewrites this month"
              used={rewritesThisMonth}
              limit={plan.rewritesPerMonth}
              format={(v) => `${v}`}
            />
            <UsageBar
              label="Capture storage"
              used={storageUsed}
              limit={bytesAsNumber(plan.storageBytes)}
              format={(v) => formatBytes(v)}
            />
          </div>
        </div>
      </section>

      {/* §03 Usage */}
      <section>
        <span className="swiss-eyebrow text-muted">— 03 / Usage</span>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Total runs" value={String(auditCount + rewriteCount)} numeric />
          <Stat label="Audits" value={String(auditCount)} numeric />
          <Stat label="Rewrites" value={String(rewriteCount)} numeric />
          <Stat label="This month" value={String(auditsThisMonth)} numeric />
          <Stat label="This week" value={String(auditsThisWeek)} numeric />
          <Stat label="Today" value={String(auditsToday)} numeric />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat
            label="Last active"
            value={new Date(lastActive).toLocaleString(undefined, {
              year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
            })}
          />
          <Stat
            label="Avg audit score"
            value={avgScore === null ? "—" : `${Math.round(avgScore)}/100`}
            numeric={avgScore !== null}
          />
          <Stat label="Capture storage" value={formatBytes(storageUsed)} />
        </div>
      </section>

      {/* §04 Score distribution + top breakdowns */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <span className="swiss-eyebrow text-muted">— 04 / Score distribution</span>
          <div className="mt-4 border border-hairline p-6">
            {totalScored === 0 ? (
              <p className="text-sm text-muted">No audits yet to score.</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {buckets.map((b) => {
                  const p = totalScored > 0 ? Math.round((b.count / totalScored) * 100) : 0;
                  return (
                    <li key={b.label} className="flex flex-col gap-1">
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="font-medium">{b.label}</span>
                        <span className="text-muted swiss-num">
                          {b.count} · {p}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-hairline">
                        <div className={`h-full ${b.tone}`} style={{ width: `${p}%` }} />
                      </div>
                      <span className="text-[10px] text-muted swiss-num">
                        {b.min}–{b.max}/100
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="lg:col-span-6">
          <span className="swiss-eyebrow text-muted">— 05 / Top breakdowns</span>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <RankList
              title="Industries audited"
              empty="No industries detected yet."
              items={topIndustriesRaw.map((row) => ({
                label: row.industry ?? "Other",
                count: row._count._all,
              }))}
            />
            <RankList
              title="Top domains"
              empty="No domains audited yet."
              items={topDomains.map(([host, count]) => ({ label: host, count }))}
            />
          </div>
        </div>
      </section>

      {/* §06 Recent activity */}
      <section>
        <div className="flex items-baseline justify-between border-b border-hairline pb-3">
          <span className="swiss-eyebrow text-muted">— 06 / Recent activity</span>
          <Link href="/history" className="text-xs text-muted underline-offset-4 hover:underline hover:text-foreground">
            View all →
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="py-12 text-sm text-muted">No activity yet.</p>
        ) : (
          <ul className="divide-y divide-hairline border-b border-hairline">
            {recent.map((item, i) => {
              const href = item.kind === "audit" ? `/audits/${item.id}` : `/rewrite-content/${item.id}`;
              return (
                <li key={`${item.kind}-${item.id}`} className="grid grid-cols-12 items-baseline gap-2 py-3 text-sm">
                  <span className="col-span-1 text-xs text-muted swiss-num">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <Link
                    href={href}
                    className="col-span-7 truncate font-medium underline-offset-4 hover:underline"
                  >
                    {item.url}
                  </Link>
                  <span className="col-span-2 swiss-eyebrow text-muted">
                    /seo {item.kind === "audit" ? item.command : "rewrite"}
                  </span>
                  <span className="col-span-2 text-right font-mono text-xs swiss-num">
                    {item.kind === "audit" ? (
                      <>
                        {item.score}
                        <span className="text-muted">/100</span>
                      </>
                    ) : (
                      <span className="text-muted">
                        {new Date(item.createdAt).toLocaleDateString(undefined, {
                          month: "short", day: "2-digit",
                        })}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* §07 Edit */}
      <section>
        <span className="swiss-eyebrow text-muted">— 07 / Edit</span>
        <div className="mt-4">
          <ProfileForm initialName={user.name ?? ""} />
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  mono,
  numeric,
}: {
  label: string;
  value: string;
  mono?: boolean;
  numeric?: boolean;
}) {
  return (
    <div className="border border-hairline p-4">
      <div className="swiss-eyebrow text-muted">{label}</div>
      <div
        className={`mt-2 break-all ${
          numeric ? "font-mono text-2xl swiss-num" : mono ? "font-mono text-xs" : "text-base font-medium"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function UsageBar({
  label,
  used,
  limit,
  format,
}: {
  label: string;
  used: number;
  limit: number;
  format: (v: number) => string;
}) {
  const p = pct(used, limit);
  const tone = p >= 90 ? "bg-accent" : p >= 70 ? "bg-amber-500" : "bg-foreground";
  return (
    <div className="border border-hairline p-4">
      <div className="flex items-baseline justify-between">
        <span className="swiss-eyebrow text-muted">{label}</span>
        <span className="text-xs text-muted swiss-num">{p}%</span>
      </div>
      <div className="mt-2 font-mono text-base swiss-num">
        {format(used)}
        <span className="text-xs text-muted"> / {format(limit)}</span>
      </div>
      <div className="mt-3 h-1 w-full bg-hairline">
        <div className={`h-full ${tone}`} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

function RankList({
  title,
  items,
  empty,
}: {
  title: string;
  items: { label: string; count: number }[];
  empty: string;
}) {
  return (
    <div className="border border-hairline p-4">
      <div className="swiss-eyebrow text-muted">{title}</div>
      {items.length === 0 ? (
        <p className="mt-3 text-xs text-muted">{empty}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {items.map((it, i) => {
            const max = items[0]?.count ?? 1;
            const p = max > 0 ? Math.round((it.count / max) * 100) : 0;
            return (
              <li key={it.label} className="flex flex-col gap-1 text-xs">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex items-baseline gap-2 truncate">
                    <span className="text-muted swiss-num">{String(i + 1).padStart(2, "0")}</span>
                    <span className="truncate font-medium">{it.label}</span>
                  </span>
                  <span className="font-mono text-muted swiss-num">{it.count}</span>
                </div>
                <div className="h-0.5 w-full bg-hairline">
                  <div className="h-full bg-foreground" style={{ width: `${p}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
