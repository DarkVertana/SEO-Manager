import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/server";
import { formatAccountId } from "@/lib/auth/account-id";
import RoleToggle from "./RoleToggle";
import UserActions from "./UserActions";
import NewUserButton from "./NewUserButton";

export default async function AdminUsersPage() {
  const session = await getSession();
  // The /admin layout already calls requireAdmin(); session is guaranteed here,
  // but we still need it to disable role + delete on the current admin's row.
  if (!session) return null;

  const [users, plansRaw] = await Promise.all([
    db.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        accountNumber: true,
        role: true,
        cancelAtPeriodEnd: true,
        createdAt: true,
        _count: { select: { audits: true, rewrites: true } },
      },
      take: 500,
    }),
    db.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { slug: true, name: true },
    }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-10 px-4 py-10 sm:gap-12 sm:px-6 sm:py-12 lg:px-12">
      {/* Header */}
      <section>
        <span className="swiss-eyebrow text-accent">— Admin · Users</span>
        <h1 className="mt-3 text-balance text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
          Users.
        </h1>
        <p className="mt-4 max-w-xl text-pretty text-sm leading-relaxed text-muted sm:mt-6 sm:text-base">
          Create, edit, promote, demote, or delete accounts. You can't delete
          or demote your own account — that guard is also enforced server-side.
        </p>
      </section>

      <section>
        <div className="flex items-baseline justify-between gap-3 border-b border-hairline pb-3">
          <div className="flex items-baseline gap-3">
            <span className="swiss-eyebrow text-muted">— Roster</span>
            <span className="text-xs text-muted swiss-num">
              {users.length} record{users.length === 1 ? "" : "s"}
            </span>
          </div>
          <NewUserButton plans={plansRaw} />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1000px] w-full text-left">
            <colgroup>
              <col className="w-[7.5rem]" />{/* Account ID */}
              <col className="w-[24%] min-w-[14rem]" />{/* Email */}
              <col className="w-[16%] min-w-[10rem]" />{/* Name */}
              <col className="w-16" />{/* Audits */}
              <col className="w-16" />{/* Rewrites */}
              <col className="w-24" />{/* Joined */}
              <col className="w-32 min-w-[7.5rem]" />{/* Role */}
              <col className="w-24" />{/* Actions */}
            </colgroup>
            <thead className="border-b border-hairline text-xs text-muted">
              <tr>
                <th className="py-3 pr-3 font-medium swiss-eyebrow">Account</th>
                <th className="py-3 pr-3 font-medium swiss-eyebrow">Email</th>
                <th className="py-3 pr-3 font-medium swiss-eyebrow">Name</th>
                <th className="py-3 pr-3 text-right font-medium swiss-eyebrow">Aud</th>
                <th className="py-3 pr-3 text-right font-medium swiss-eyebrow">Rew</th>
                <th className="py-3 pr-3 font-medium swiss-eyebrow">Joined</th>
                <th className="py-3 pr-3 font-medium swiss-eyebrow">Role</th>
                <th className="py-3 pr-3 font-medium swiss-eyebrow">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-sm text-muted">
                    No users yet.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
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
                    <td className="truncate py-4 pr-3 align-top text-xs text-muted">
                      {u.name ?? "—"}
                    </td>
                    <td className="py-4 pr-3 text-right align-top font-mono text-xs swiss-num">
                      {u._count.audits}
                    </td>
                    <td className="py-4 pr-3 text-right align-top font-mono text-xs swiss-num">
                      {u._count.rewrites}
                    </td>
                    <td className="py-4 pr-3 align-top text-xs text-muted swiss-num">
                      {new Date(u.createdAt).toLocaleDateString(undefined, {
                        year: "2-digit",
                        month: "short",
                        day: "2-digit",
                      })}
                    </td>
                    <td className="py-4 pr-3 align-top">
                      <RoleToggle
                        userId={u.id}
                        email={u.email}
                        role={u.role}
                        isSelf={u.id === session.uid}
                      />
                    </td>
                    <td className="py-4 pr-3 align-top">
                      <UserActions
                        user={{ id: u.id, email: u.email, name: u.name }}
                        isSelf={u.id === session.uid}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
