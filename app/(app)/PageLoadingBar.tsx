"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// Solid-black indeterminate progress bar pinned to the bottom edge of the
// header. Activates when the user clicks an internal link, deactivates once
// the new pathname takes effect (with a hard ceiling so it can't get stuck).
export default function PageLoadingBar() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  // Detect internal-link clicks via event delegation so we don't have to wrap
  // every <Link>. Bails on modifier keys, new-tab targets, downloads, hash
  // jumps, and external origins.
  useEffect(() => {
    function isInternalLink(link: HTMLAnchorElement): boolean {
      if (!link.href) return false;
      if (link.target && link.target !== "_self") return false;
      if (link.hasAttribute("download")) return false;
      try {
        const url = new URL(link.href, window.location.href);
        if (url.origin !== window.location.origin) return false;
        if (
          url.pathname === window.location.pathname &&
          url.search === window.location.search
        ) {
          return false;
        }
        return true;
      } catch {
        return false;
      }
    }
    function onClick(e: MouseEvent) {
      // Listen in CAPTURE phase below, so we run before Next's <Link> calls
      // preventDefault. That means we should NOT bail on defaultPrevented —
      // we just gate on modifier keys + button + internal-href.
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const link = target?.closest("a");
      if (!link) return;
      if (!isInternalLink(link as HTMLAnchorElement)) return;
      setActive(true);
    }
    // Capture phase so the bar fires even when downstream handlers stopPropagation.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Tear down once the new pathname has settled.
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setActive(false), 220);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Safety ceiling: if the click never produced a pathname change (same-route
  // search params, blocked navigation, etc.), don't leave the bar on forever.
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setActive(false), 6000);
    return () => clearTimeout(t);
  }, [active]);

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-x-0 -bottom-px h-[2px] overflow-hidden ${
        active ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="page-load-sweep h-full bg-foreground" />
      <style jsx>{`
        .page-load-sweep {
          position: absolute;
          top: 0;
          left: -30%;
          width: 30%;
          animation: page-load-sweep 1.05s ease-in-out infinite;
        }
        @keyframes page-load-sweep {
          0% {
            left: -30%;
            width: 30%;
          }
          50% {
            left: 35%;
            width: 45%;
          }
          100% {
            left: 100%;
            width: 30%;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .page-load-sweep {
            animation: none;
            left: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
