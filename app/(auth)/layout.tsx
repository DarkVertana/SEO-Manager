import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-12">
      <aside className="hidden border-r border-hairline bg-background/60 backdrop-blur-md lg:col-span-5 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Link href="/" className="swiss-eyebrow">
          SEO / MANAGER
        </Link>
        <div className="flex flex-col gap-6">
          <p className="swiss-eyebrow text-muted">— 01 / Method</p>
          <h1 className="text-5xl font-medium leading-[1.05] tracking-tight">
            Audit. Score.
            <br />
            Ship.
          </h1>
          <p className="max-w-md text-base leading-relaxed text-muted">
            Single-page deep analysis and full-site audits — seven specialist
            agents working in parallel, with AI search readiness scoring and
            machine-written-content detection.
          </p>
        </div>
        <div className="flex justify-between text-xs text-muted swiss-num">
          <span>EST. 2026</span>
          <span>ZÜRICH × WEB</span>
        </div>
      </aside>

      <main className="flex flex-col justify-center px-4 py-10 sm:px-6 sm:py-12 lg:col-span-7 lg:px-16">
        <div className="mx-auto w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
