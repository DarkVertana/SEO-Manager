import { getBrowser, CAPTURE_USER_AGENT, CAPTURE_VIEWPORT } from "./browser";

export type ScreenshotSession = {
  screenshot(selector: string): Promise<Buffer | null>;
  close(): Promise<void>;
};

// Open ONE Chromium page for the whole rewrite run. setContent + network
// settling happens once instead of per section, which is the chunk of time
// the user was waiting on.
export async function openScreenshotSession(html: string): Promise<ScreenshotSession> {
  const browser = await getBrowser();
  const ctx = await browser.newContext({
    viewport: CAPTURE_VIEWPORT,
    deviceScaleFactor: 1,
    userAgent: CAPTURE_USER_AGENT,
  });
  const page = await ctx.newPage();

  try {
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 20000 });
    // Best-effort wait for fonts/images. Many sites never go fully idle
    // (analytics polling, chat widgets) — short bounded wait then move on.
    try { await page.waitForLoadState("networkidle", { timeout: 3500 }); } catch { /* ignore */ }
    await page.waitForTimeout(300);
  } catch {
    // Even if setContent partially failed we still try the screenshots.
  }

  return {
    async screenshot(selector: string): Promise<Buffer | null> {
      try {
        const el = await page.$(selector);
        if (!el) return null;
        // Scrolling first triggers any IntersectionObserver-based lazy
        // images for that section. Bounded so we never block on reflow.
        try { await el.scrollIntoViewIfNeeded({ timeout: 1500 }); } catch { /* ignore */ }
        return await el.screenshot({ type: "png", timeout: 10000 });
      } catch {
        return null;
      }
    },
    async close() {
      await ctx.close().catch(() => null);
    },
  };
}
