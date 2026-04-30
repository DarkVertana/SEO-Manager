import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/server";
import DeleteActivityButton from "./DeleteActivityButton";

type ActivityItem =
  | {
      kind: "audit";
      id: string;
      url: string;
      command: string;
      industry: string | null;
      score: number;
      createdAt: Date;
    }
  | {
      kind: "rewrite";
      id: string;
      url: string;
      industry: null;
      command: "rewrite";
      byteSize: number;
      createdAt: Date;
    };

const PAGE_SIZE = 25;
// Fetch cap per table — keeps memory bounded for a personal tool. If you ever
// blow past this, swap the merge approach for a Prisma raw UNION ALL query.
const FETCH_CAP = 500;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const sp = await searchParams;
  const requestedPage = Math.max(1, Number(sp.page) || 1);

  const [audits, rewrites] = await Promise.all([
    db.seoAnalysis.findMany({
      where: { userId: session.uid },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        url: true,
        command: true,
        industry: true,
        overallScore: true,
        createdAt: true,
      },
      take: FETCH_CAP,
    }),
    db.rewritePage.findMany({
      where: { userId: session.uid },
      orderBy: { createdAt: "desc" },
      select: { id: true, url: true, byteSize: true, createdAt: true },
      take: FETCH_CAP,
    }),
  ]);

  const merged: ActivityItem[] = [
    ...audits.map((a): ActivityItem => ({
      kind: "audit",
      id: a.id,
      url: a.url,
      command: a.command,
      industry: a.industry,
      score: a.overallScore,
      createdAt: a.createdAt,
    })),
    ...rewrites.map((r): ActivityItem => ({
      kind: "rewrite",
      id: r.id,
      url: r.url,
      industry: null,
      command: "rewrite",
      byteSize: r.byteSize,
      createdAt: r.createdAt,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const totalCount = merged.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * PAGE_SIZE;
  const visible = merged.slice(offset, offset + PAGE_SIZE);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-10 px-4 py-10 sm:gap-12 sm:px-6 sm:py-12 lg:gap-16 lg:px-12">
      <section className="grid grid-cols-1 gap-y-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <span className="swiss-eyebrow text-muted">— History</span>
          <h1 className="mt-3 text-balance text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Recent activity.
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-sm leading-relaxed text-muted sm:mt-6 sm:text-base">
            Every audit, page analysis, architecture review, programmatic-SEO
            design, and rewrite capture you've run on this account.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-end sm:gap-3 lg:col-span-5">
          <Link
            href="/"
            className="bg-foreground px-5 py-2.5 text-center text-sm font-medium text-background transition-opacity hover:opacity-85"
          >
            Run a skill →
          </Link>
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between border-b border-hairline pb-3">
          <span className="swiss-eyebrow text-muted">— Activity</span>
          <span className="text-xs text-muted swiss-num">
            {totalCount === 0
              ? "0 records"
              : `${offset + 1}–${Math.min(offset + PAGE_SIZE, totalCount)} of ${totalCount}`}
          </span>
        </div>

        {totalCount === 0 ? (
          <p className="py-16 text-sm text-muted">
            No activity yet. Pick a skill from the home page and run it on a URL.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-left">
                <colgroup>
                  <col className="w-12" />
                  <col />
                  <col className="w-32" />
                  <col className="w-28" />
                  <col className="w-44" />
                  <col className="w-24" />
                  <col className="w-16" />
                </colgroup>
                <thead className="text-xs text-muted">
                  <tr className="border-b border-hairline">
                    <th className="py-3 pr-3 font-medium swiss-eyebrow">№</th>
                    <th className="py-3 pr-3 font-medium swiss-eyebrow">URL</th>
                    <th className="py-3 pr-3 font-medium swiss-eyebrow">Skill</th>
                    <th className="py-3 pr-3 font-medium swiss-eyebrow">Industry</th>
                    <th className="py-3 pr-3 font-medium swiss-eyebrow">Date</th>
                    <th className="py-3 pr-3 text-right font-medium swiss-eyebrow">Result</th>
                    <th className="py-3 pr-3 text-right font-medium swiss-eyebrow">Del</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {visible.map((item, i) => {
                    const href =
                      item.kind === "audit" ? `/audits/${item.id}` : `/rewrite-content/${item.id}`;
                    const rowNumber = offset + i + 1;
                    return (
                      <tr key={`${item.kind}-${item.id}`} className="text-sm">
                        <td className="py-3 pr-3 align-top text-xs text-muted swiss-num">
                          {String(rowNumber).padStart(3, "0")}
                        </td>
                        <td className="truncate py-3 pr-3 align-top">
                          <Link
                            href={href}
                            className="font-medium underline-offset-4 hover:underline"
                          >
                            {item.url}
                          </Link>
                        </td>
                        <td className="truncate py-3 pr-3 align-top">
                          <span className="swiss-eyebrow text-muted">/seo {item.command}</span>
                        </td>
                        <td className="truncate py-3 pr-3 align-top text-xs text-muted">
                          {item.industry ?? "—"}
                        </td>
                        <td className="py-3 pr-3 align-top text-xs text-muted swiss-num">
                          {new Date(item.createdAt).toLocaleString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-3 pr-3 text-right align-top font-mono text-base swiss-num">
                          {item.kind === "audit" ? (
                            <>
                              {item.score}
                              <span className="text-xs text-muted">/100</span>
                            </>
                          ) : (
                            <span className="text-xs text-muted">{formatBytes(item.byteSize)}</span>
                          )}
                        </td>
                        <td className="py-3 pr-3 text-right align-top">
                          <DeleteActivityButton kind={item.kind} id={item.id} url={item.url} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && <Pagination page={page} totalPages={totalPages} />}
          </>
        )}
      </section>
    </div>
  );
}

function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  const prevHref = page > 1 ? `/history?page=${page - 1}` : null;
  const nextHref = page < totalPages ? `/history?page=${page + 1}` : null;
  // Build a compact page index: 1 … current-1, current, current+1 … total
  const pageNumbers: (number | "…")[] = [];
  const seen = new Set<number>();
  function push(n: number) {
    if (n < 1 || n > totalPages || seen.has(n)) return;
    seen.add(n);
    pageNumbers.push(n);
  }
  push(1);
  if (page - 1 > 2) pageNumbers.push("…");
  push(page - 1);
  push(page);
  push(page + 1);
  if (page + 1 < totalPages - 1) pageNumbers.push("…");
  push(totalPages);

  return (
    <nav
      aria-label="History pagination"
      className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4 sm:gap-4"
    >
      {prevHref ? (
        <Link
          href={prevHref}
          className="border border-hairline px-3 py-1.5 text-xs hover:border-foreground"
          rel="prev"
        >
          ← Prev
        </Link>
      ) : (
        <span
          aria-disabled
          className="border border-hairline px-3 py-1.5 text-xs text-muted opacity-40"
        >
          ← Prev
        </span>
      )}

      <ol className="flex flex-wrap items-center gap-1 text-xs swiss-num">
        {pageNumbers.map((n, i) =>
          n === "…" ? (
            <li key={`gap-${i}`} className="px-2 text-muted">
              …
            </li>
          ) : (
            <li key={n}>
              <Link
                href={`/history?page=${n}`}
                aria-current={n === page ? "page" : undefined}
                className={`min-w-[2rem] border px-2 py-1 text-center transition-colors ${
                  n === page
                    ? "border-foreground bg-foreground text-background"
                    : "border-hairline text-muted hover:border-foreground hover:text-foreground"
                }`}
              >
                {String(n).padStart(2, "0")}
              </Link>
            </li>
          ),
        )}
      </ol>

      {nextHref ? (
        <Link
          href={nextHref}
          className="border border-hairline px-3 py-1.5 text-xs hover:border-foreground"
          rel="next"
        >
          Next →
        </Link>
      ) : (
        <span
          aria-disabled
          className="border border-hairline px-3 py-1.5 text-xs text-muted opacity-40"
        >
          Next →
        </span>
      )}
    </nav>
  );
}
