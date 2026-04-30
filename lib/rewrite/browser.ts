import { chromium, type Browser } from "playwright";

let browserPromise: Promise<Browser> | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true });
    process.once("beforeExit", async () => {
      try {
        const b = await browserPromise;
        await b?.close().catch(() => null);
      } catch { /* ignore */ }
    });
  }
  return browserPromise;
}

export const CAPTURE_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

export const CAPTURE_VIEWPORT = { width: 1280, height: 1800 };
