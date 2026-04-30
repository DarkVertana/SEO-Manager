import Link from "next/link";
import { getSession } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import LogoutButton from "./LogoutButton";
import MobileMenu from "./MobileMenu";
import PageLoadingBar from "./PageLoadingBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-hairline bg-background/70 backdrop-blur-md">
        <PageLoadingBar />
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4 lg:px-12">
          <Link href="/" className="flex shrink-0 items-baseline gap-3">
            <span className="swiss-eyebrow text-[10px] sm:text-[11px]">SEO / MANAGER</span>
            <span className="hidden h-3 w-px bg-hairline md:inline-block" />
            <span className="hidden text-xs text-muted md:inline-block">v1.0</span>
          </Link>

          {/* Desktop / tablet inline nav (md+) */}
          <nav className="hidden items-center gap-6 text-sm md:flex">
            <Link href="/" className="hover:underline underline-offset-4">
              Home
            </Link>
            <Link href="/manual" className="hover:underline underline-offset-4">
              Manual
            </Link>
            <Link href="/history" className="hover:underline underline-offset-4">
              History
            </Link>
            <Link href="/profile" className="hover:underline underline-offset-4">
              Profile
            </Link>
            {session.role === "admin" && (
              <Link
                href="/admin"
                className="border border-accent px-2 py-0.5 text-[11px] tracking-widest text-accent hover:bg-accent hover:text-white"
              >
                ADMIN
              </Link>
            )}
            <span className="h-3 w-px bg-hairline" />
            <LogoutButton />
          </nav>

          {/* Mobile hamburger (< md). Opens a full-screen overlay menu. */}
          <div className="md:hidden">
            <MobileMenu email={session.email} role={session.role} />
          </div>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
      <footer className="mx-auto w-full max-w-[1400px] px-4 py-4 text-center text-[10px] tracking-widest text-muted swiss-num sm:px-6 sm:text-[11px] lg:px-12">
        © 2026 SEO MANAGER
      </footer>
    </div>
  );
}
