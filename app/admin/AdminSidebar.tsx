"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import LogoutButton from "../(app)/LogoutButton";
import PageLoadingBar from "../(app)/PageLoadingBar";

const NAV: { href: string; index: string; label: string; sub: string; match: (p: string) => boolean }[] = [
  {
    href: "/admin",
    index: "01",
    label: "Overview",
    sub: "Workspace stats & recent activity",
    match: (p) => p === "/admin",
  },
  {
    href: "/admin/users",
    index: "02",
    label: "Users",
    sub: "Roster, roles & account IDs",
    match: (p) => p.startsWith("/admin/users"),
  },
  {
    href: "/admin/subscriptions",
    index: "03",
    label: "Subscriptions",
    sub: "Per-user billing cycles & status",
    match: (p) => p.startsWith("/admin/subscriptions"),
  },
  {
    href: "/admin/plans",
    index: "04",
    label: "Plans",
    sub: "Pricing, limits & features",
    match: (p) => p.startsWith("/admin/plans"),
  },
];

export default function AdminSidebar({ email }: { email: string }) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close drawer on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while open + ESC to close
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      {/* Mobile top bar (< md). Sticky strip with hamburger trigger. */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-hairline bg-background/70 px-4 py-3 backdrop-blur-md md:hidden">
        <PageLoadingBar />
        <Link href="/admin" className="flex items-baseline gap-3">
          <span className="swiss-eyebrow text-[10px]">SEO / MANAGER</span>
          <span className="swiss-eyebrow text-[10px] text-accent">ADMIN</span>
        </Link>
        <button
          type="button"
          aria-label="Open admin navigation"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="-mr-2 inline-flex h-10 w-10 items-center justify-center text-foreground"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" aria-hidden>
            <path d="M3 7h18M3 12h18M3 17h18" />
          </svg>
        </button>
      </div>

      {/* Desktop sidebar (md+). Sticky to viewport, hairline divider on right. */}
      <aside className="hidden shrink-0 border-r border-hairline bg-background/60 backdrop-blur-md md:flex md:w-64 md:flex-col">
        <SidebarBody email={email} pathname={pathname} />
      </aside>

      {/* Mobile drawer (< md). Portalled to body to escape stacking contexts. */}
      {mounted && open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation"
            className="fixed inset-0 z-[100] flex"
          >
            <button
              type="button"
              aria-label="Close menu"
              tabIndex={-1}
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <aside className="relative flex h-full w-72 max-w-[85vw] flex-col border-r border-hairline bg-background">
              <div className="flex items-center justify-end border-b border-hairline px-4 py-3">
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                  className="-mr-2 inline-flex h-10 w-10 items-center justify-center text-foreground"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" aria-hidden>
                    <path d="M5 5l14 14M19 5L5 19" />
                  </svg>
                </button>
              </div>
              <SidebarBody email={email} pathname={pathname} />
            </aside>
          </div>,
          document.body,
        )}
    </>
  );
}

function SidebarBody({ email, pathname }: { email: string; pathname: string }) {
  return (
    <div className="flex h-full flex-col md:sticky md:top-0 md:h-screen">
      {/* Header */}
      <div className="hidden flex-col gap-1 border-b border-hairline px-6 py-6 md:flex">
        <Link href="/admin" className="swiss-eyebrow text-[11px]">
          SEO / MANAGER
        </Link>
        <span className="swiss-eyebrow text-[10px] text-accent">— ADMIN PANEL</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-6 py-6">
        <ol className="flex flex-col gap-0">
          {NAV.map((item) => {
            const active = item.match(pathname);
            return (
              <li key={item.href} className="border-b border-hairline last:border-b-0">
                <Link
                  href={item.href}
                  className="block py-4"
                  aria-current={active ? "page" : undefined}
                >
                  <div className="flex items-baseline gap-3">
                    <span
                      className={`swiss-eyebrow swiss-num ${
                        active ? "text-accent" : "text-muted"
                      }`}
                    >
                      — {item.index}
                    </span>
                    <span
                      className={`text-lg font-medium tracking-tight transition-opacity ${
                        active ? "opacity-100" : "opacity-80 hover:opacity-100"
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                  <p className="mt-1 pl-6 text-[11px] text-muted">{item.sub}</p>
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Footer / account */}
      <div className="border-t border-hairline px-6 py-5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="swiss-eyebrow text-muted">— Account</span>
          <span className="swiss-eyebrow text-[10px] text-accent">ADMIN</span>
        </div>
        <p className="mt-2 break-all font-mono text-[11px] text-muted">{email}</p>
        <div className="mt-4 flex justify-end border-t border-hairline pt-3">
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
