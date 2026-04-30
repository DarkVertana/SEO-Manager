"use client";

import Link from "next/link";
import { useEffect } from "react";

// Global error boundary. Without this, a thrown server component error
// renders the platform's default error page (which on some hosts shows
// as a 404). This catches the throw and gives the user a recovery path.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-130px)] w-full max-w-2xl flex-col items-center justify-center gap-6 px-4 py-10 text-center sm:gap-8 sm:px-6 sm:py-16">
      <span className="swiss-eyebrow text-accent">— Something went wrong</span>
      <h1 className="text-balance text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
        Error.
      </h1>
      <p className="max-w-md text-pretty text-sm leading-relaxed text-muted sm:text-base">
        We hit an unexpected issue rendering this page. Try again, or head
        home and pick a different route.
      </p>
      {error.digest && (
        <p className="font-mono text-[11px] text-muted">ref: {error.digest}</p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
        <button
          type="button"
          onClick={reset}
          className="bg-foreground px-5 py-2.5 text-center text-sm font-medium text-background transition-opacity hover:opacity-85"
        >
          Try again
        </button>
        <Link
          href="/"
          className="border border-hairline px-5 py-2.5 text-center text-sm font-medium hover:border-foreground"
        >
          Home →
        </Link>
      </div>
    </div>
  );
}
