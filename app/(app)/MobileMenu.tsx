"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import LogoutButton from "./LogoutButton";

const BASE_NAV: { href: string; label: string; admin?: boolean }[] = [
  { href: "/", label: "Home" },
  { href: "/manual", label: "Manual" },
  { href: "/history", label: "History" },
  { href: "/profile", label: "Profile" },
];

export default function MobileMenu({
  email,
  role = "user",
}: {
  email: string;
  role?: "user" | "admin";
}) {
  const NAV = role === "admin"
    ? [...BASE_NAV, { href: "/admin", label: "Admin", admin: true }]
    : BASE_NAV;
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  // The overlay is portalled to document.body. We need a client-side mount
  // gate so the portal target exists; otherwise SSR runs createPortal with
  // an undefined target and crashes.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close the overlay whenever the route changes (link tap = navigate + close).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the overlay is open and listen for ESC.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((o) => !o)}
        className="-mr-2 inline-flex h-10 w-10 items-center justify-center text-foreground"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" aria-hidden>
            <path d="M5 5l14 14M19 5L5 19" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" aria-hidden>
            <path d="M3 7h18M3 12h18M3 17h18" />
          </svg>
        )}
      </button>

      {mounted && open &&
        createPortal(
          <div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
            className="fixed inset-0 z-[100] flex flex-col bg-background"
          >
            <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
              <span className="swiss-eyebrow text-[10px]">SEO / MANAGER</span>
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

            <nav className="flex flex-1 flex-col justify-between overflow-y-auto px-6 py-10">
              <ol className="flex flex-col gap-2">
                {NAV.map((item, i) => {
                  const active = pathname === item.href || (item.href === "/admin" && pathname?.startsWith("/admin"));
                  return (
                    <li key={item.href} className="border-b border-hairline">
                      <Link
                        href={item.href}
                        className="flex items-baseline gap-4 py-5"
                      >
                        <span className="swiss-eyebrow text-muted swiss-num">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span
                          className={`text-4xl font-medium tracking-tight transition-opacity ${
                            active ? "opacity-100" : "opacity-70"
                          } ${item.admin ? "text-accent" : ""}`}
                        >
                          {item.label}
                        </span>
                        {active && (
                          <span className="ml-auto self-center text-xs text-muted">
                            Current
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ol>

              <div className="mt-10 flex flex-col gap-3 border-t border-hairline pt-6">
                <span className="swiss-eyebrow text-muted">— Account</span>
                <span className="break-all text-sm">{email}</span>
                <div className="mt-2">
                  <LogoutButton />
                </div>
              </div>
            </nav>
          </div>,
          document.body,
        )}
    </>
  );
}
