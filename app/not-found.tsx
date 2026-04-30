import Link from "next/link";

// Branded 404 page. Shown for any unmatched route — confirms the request
// reached Next.js (vs. a platform-level 404 that would not render this).
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-130px)] w-full max-w-2xl flex-col items-center justify-center gap-6 px-4 py-10 text-center sm:gap-8 sm:px-6 sm:py-16">
      <span className="swiss-eyebrow text-muted">— 404</span>
      <h1 className="text-balance text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
        Not found.
      </h1>
      <p className="max-w-md text-pretty text-sm leading-relaxed text-muted sm:text-base">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
        <Link
          href="/"
          className="bg-foreground px-5 py-2.5 text-center text-sm font-medium text-background transition-opacity hover:opacity-85"
        >
          Home →
        </Link>
        <Link
          href="/login"
          className="border border-hairline px-5 py-2.5 text-center text-sm font-medium hover:border-foreground"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
