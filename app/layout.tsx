import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Component as EtherealShadow } from "@/components/ui/etheral-shadow";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SEO Manager",
  description: "AI-powered SEO audits and content analysis",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Site-wide ambient backdrop. Fixed to the viewport so it stays put
            on scroll, pointer-events-none so it never blocks interactions,
            aria-hidden so it's invisible to screen readers. The component's
            built-in <h1> is suppressed via [&_h1]:hidden so it doesn't bleed
            into copy on every page. The wrapping div adds a slow drift
            (translate + scale + hue rotation) ON TOP of the SVG turbulence
            so the visible motion is unmistakable rather than subtle. */}
        <div
          aria-hidden
          className="bg-drift pointer-events-none fixed inset-0 z-0 opacity-50 [&_h1]:hidden"
        >
          <EtherealShadow
            color="rgba(115, 115, 115, 0.6)"
            animation={{ scale: 100, speed: 90 }}
            noise={{ opacity: 0.55, scale: 1.4 }}
            sizing="fill"
          />
        </div>
        <div className="relative z-10 flex min-h-full flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
