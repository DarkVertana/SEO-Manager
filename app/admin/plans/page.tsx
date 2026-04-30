import { db } from "@/lib/db";
import { bytesAsNumber, formatBytes, formatPrice } from "@/lib/auth/plan";
import PlanRow from "./PlanRow";
import NewPlanButton from "./NewPlanButton";

export default async function AdminPlansPage() {
  const plans = await db.plan.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { users: true } } },
  });

  // Compute monthly recurring revenue per plan so admins see contribution
  const totalMrr = plans.reduce(
    (sum, p) => sum + p.monthlyPriceCents * p._count.users,
    0,
  );

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-10 px-4 py-10 sm:gap-12 sm:px-6 sm:py-12 lg:px-12">
      <section>
        <span className="swiss-eyebrow text-accent">— Admin · Plans</span>
        <h1 className="mt-3 text-balance text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
          Plans.
        </h1>
        <p className="mt-4 max-w-xl text-pretty text-sm leading-relaxed text-muted sm:mt-6 sm:text-base">
          Create, edit, or retire pricing tiers. Each row has live limits,
          features, and the count of users currently on that plan.
        </p>
      </section>

      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Plans" value={String(plans.length)} numeric />
          <Stat label="Active" value={String(plans.filter((p) => p.isActive).length)} numeric />
          <Stat
            label="MRR"
            value={formatPrice(totalMrr, plans[0]?.currency ?? "USD") + (totalMrr ? "/mo" : "")}
          />
          <Stat
            label="Total users"
            value={String(plans.reduce((s, p) => s + p._count.users, 0))}
            numeric
          />
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between border-b border-hairline pb-3">
          <span className="swiss-eyebrow text-muted">— Catalog</span>
          <NewPlanButton />
        </div>

        {plans.length === 0 ? (
          <p className="py-16 text-sm text-muted">No plans yet. Create one to get started.</p>
        ) : (
          <ul className="divide-y divide-hairline border-b border-hairline">
            {plans.map((p) => (
              <PlanRow
                key={p.slug}
                plan={{
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
                  isActive: p.isActive,
                  isPublic: p.isPublic,
                  userCount: p._count.users,
                }}
              />
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
  numeric,
}: {
  label: string;
  value: string;
  numeric?: boolean;
}) {
  return (
    <div className="border border-hairline p-4">
      <div className="swiss-eyebrow text-muted">{label}</div>
      <div className={`mt-2 break-all ${numeric ? "font-mono text-2xl swiss-num" : "text-base font-medium"}`}>
        {value}
      </div>
    </div>
  );
}
