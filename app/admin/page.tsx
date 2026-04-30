import Link from "next/link";
import { db } from "@/lib/db";
import { formatBytes } from "@/lib/auth/plan";

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default async function AdminOverview() {
  const now = new Date();
  const dayStart = startOfDay(now);
  const monthStart = startOfMonth(now);

  const [
    userCount,
    adminCount,
    auditTotal,
    rewriteTotal,
    auditsToday,
    auditsThisMonth,
    rewriteStorage,
    avgScore,
    topIndustries,
    recentSignups,
    recentAudits,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { role: "admin" } }),
    db.seoAnalysis.count(),
    db.rewritePage.count(),
    db.seoAnalysis.count({ where: { createdAt: { gte: dayStart } } }),
    db.seoAnalysis.count({ where: { createdAt: { gte: monthStart } } }),
    db.rewritePage.aggregate({ _sum: { byteSize: true } }),
    db.seoAnalysis.aggregate({ _avg: { overallScore: true } }),
    db.seoAnalysis.groupBy({
      by: ["industry"],
      where: { industry: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { industry: "desc" } },
      take: 6,
    }),
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, accountNumber: true, role: true, createdAt: true },
      take: 6,
    }),
    db.seoAnalysis.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, url: true, command: true, overallScore: true, createdAt: true,
        user: { select: { email: true } },
      },
      take: 8,
    }),
  ]);

  const storage = rewriteStorage._sum.byteSize ?? 0;
  const avg = avgScore._avg.overallScore;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-10 px-4 py-10 sm:gap-12 sm:px-6 sm:py-12 lg:gap-16 lg:px-12">
      {/* Header */}
      <section>
        <span className="swiss-eyebrow text-accent">— Admin · Overview</span>
        <h1 className="mt-3 text-balance text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
          Control panel.
        </h1>
        <p className="mt-4 max-w-xl text-pretty text-sm leading-relaxed text-muted sm:mt-6 sm:text-base">
          Workspace-wide stats. Switch to{" "}
          <Link href="/admin/users" className="underline underline-offset-4 hover:text-foreground">
            Users
          </Link>{" "}
          to manage roles.
        </p>
      </section>

      {/* Stats */}
      <section>
        <span className="swiss-eyebrow text-muted">— 01 / Workspace</span>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Users" value={String(userCount)} numeric />
          <Stat label="Admins" value={String(adminCount)} numeric />
          <Stat label="Audits" value={String(auditTotal)} numeric />
          <Stat label="Rewrites" value={String(rewriteTotal)} numeric />
          <Stat label="Audits today" value={String(auditsToday)} numeric />
          <Stat label="Audits this month" value={String(auditsThisMonth)} numeric />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="Capture storage" value={formatBytes(storage)} />
          <Stat
            label="Avg audit score"
            value={avg === null ? "—" : `${Math.round(avg)}/100`}
            numeric={avg !== null}
          />
          <Stat label="Generated" value={now.toLocaleString()} />
        </div>
      </section>

      {/* Recent signups */}
      <section className="grid grid-cols-1 gap-12 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <div className="flex items-baseline justify-between border-b border-hairline pb-3">
            <span className="swiss-eyebrow text-muted">— 02 / Recent signups</span>
            <Link href="/admin/users" className="text-xs text-muted underline-offset-4 hover:underline hover:text-foreground">
              All users →
            </Link>
          </div>
          <ul className="divide-y divide-hairline border-b border-hairline">
            {recentSignups.length === 0 ? (
              <li className="py-12 text-sm text-muted">No users yet.</li>
            ) : (
              recentSignups.map((u, i) => (
                <li key={u.id} className="grid grid-cols-12 items-baseline gap-2 py-3 text-sm">
                  <span className="col-span-1 text-xs text-muted swiss-num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="col-span-7 truncate font-mono text-xs">{u.email}</span>
                  <span className="col-span-2 swiss-eyebrow text-muted">{u.role.toUpperCase()}</span>
                  <span className="col-span-2 text-right font-mono text-[11px] text-muted swiss-num">
                    {new Date(u.createdAt).toLocaleDateString(undefined, { month: "short", day: "2-digit" })}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Top industries */}
        <div className="lg:col-span-6">
          <div className="flex items-baseline justify-between border-b border-hairline pb-3">
            <span className="swiss-eyebrow text-muted">— 03 / Top industries</span>
          </div>
          {topIndustries.length === 0 ? (
            <p className="py-12 text-sm text-muted">No industries detected.</p>
          ) : (
            <ul className="flex flex-col gap-2 border-b border-hairline pb-4 pt-3">
              {topIndustries.map((row, i) => {
                const max = topIndustries[0]?._count._all ?? 1;
                const p = Math.round((row._count._all / max) * 100);
                return (
                  <li key={row.industry ?? i} className="flex flex-col gap-1 text-xs">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="flex items-baseline gap-2 truncate">
                        <span className="text-muted swiss-num">{String(i + 1).padStart(2, "0")}</span>
                        <span className="truncate font-medium">{row.industry ?? "Other"}</span>
                      </span>
                      <span className="font-mono text-muted swiss-num">{row._count._all}</span>
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
      </section>

      {/* Recent audits */}
      <section>
        <div className="flex items-baseline justify-between border-b border-hairline pb-3">
          <span className="swiss-eyebrow text-muted">— 04 / Recent audits (workspace-wide)</span>
        </div>
        {recentAudits.length === 0 ? (
          <p className="py-12 text-sm text-muted">No audits yet.</p>
        ) : (
          <ul className="divide-y divide-hairline border-b border-hairline">
            {recentAudits.map((a, i) => (
              <li key={a.id} className="grid grid-cols-12 items-baseline gap-2 py-3 text-sm">
                <span className="col-span-1 text-xs text-muted swiss-num">{String(i + 1).padStart(2, "0")}</span>
                <Link href={`/audits/${a.id}`} className="col-span-5 truncate font-medium underline-offset-4 hover:underline">
                  {a.url}
                </Link>
                <span className="col-span-3 truncate font-mono text-xs text-muted">{a.user.email}</span>
                <span className="col-span-1 swiss-eyebrow text-muted">{a.command}</span>
                <span className="col-span-2 text-right font-mono text-xs swiss-num">
                  {a.overallScore}
                  <span className="text-muted">/100</span>
                </span>
              </li>
            ))}
          </ul>
        )}
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
