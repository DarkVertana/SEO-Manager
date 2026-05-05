import Link from "next/link";

// Rewrite is temporarily disabled. We keep the route mounted (rather than 404)
// so existing bookmarks/history links land on a clear notice instead of a
// generic not-found screen. Re-enable by restoring the original page.tsx.
export default function RewriteContentDisabledPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-130px)] w-full max-w-[1400px] flex-col items-center justify-center px-4 py-10 text-center sm:px-6 sm:py-16 lg:px-12">
      <div className="flex w-full max-w-xl flex-col items-center gap-6">
        <span className="swiss-eyebrow text-muted">— TEMPORARILY UNAVAILABLE</span>
        <h1 className="text-balance text-3xl font-medium leading-[1.1] tracking-tight sm:text-4xl">
          /seo rewrite is offline.
        </h1>
        <p className="max-w-md text-pretty text-sm leading-relaxed text-muted sm:text-base">
          We&apos;ve paused the rewrite workspace while we make improvements.
          Audits, architecture, and programmatic SEO are still available.
        </p>
        <Link
          href="/"
          className="bg-foreground px-6 py-3 text-sm font-medium tracking-wide text-background transition-opacity hover:opacity-85"
        >
          Back to home →
        </Link>
      </div>
    </div>
  );
}
