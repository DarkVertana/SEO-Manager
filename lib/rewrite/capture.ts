// Capture an entire page so it renders standalone from our preview route.
//
// Pipeline:
//   1. Open the page in a real headless Chromium (Playwright). This handles
//      SPA hydration, dynamic CSS-in-JS, runtime <link> injection, lazy
//      images, async fonts — the things that a plain HTTP GET would miss.
//   2. While the page is loading, hook every CSS response so we can inline
//      stylesheets without refetching them later (which would lose cookies,
//      bust caches, and sometimes 403 against bot UAs).
//   3. Scroll the rendered page so IntersectionObserver-based lazy loaders
//      fire and `data-src` attributes get promoted by the site's own JS.
//   4. Serialize the post-render DOM and run our cheerio post-processing:
//      absolutize asset URLs, strip framing elements, inject the placeholder
//      bootstrap, inline external CSS from the captured response cache.

import * as cheerio from "cheerio";
import { CAPTURE_USER_AGENT, CAPTURE_VIEWPORT, getBrowser } from "./browser";

const USER_AGENT = CAPTURE_USER_AGENT;

const ACCEPT_CSS = "text/css,*/*;q=0.1";

const MAX_IMPORT_DEPTH = 5;

export type CaptureResult = {
  html: string;
  title: string | null;
  cssCount: number;
};

async function fetchText(url: string, accept = ACCEPT_CSS, referer?: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent": USER_AGENT,
        accept,
        ...(referer ? { referer } : {}),
        "accept-language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function rewriteCssUrls(css: string, base: URL): string {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (_match, q, raw) => {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("#")) {
      return `url(${q}${raw}${q})`;
    }
    try {
      return `url(${q}${new URL(trimmed, base).toString()}${q})`;
    } catch {
      return `url(${q}${raw}${q})`;
    }
  });
}

// Recursively inline @import statements in CSS so nested CSS files load
// without ever leaving the captured document. Depth-limited to avoid loops.
async function inlineCssImports(
  css: string,
  base: URL,
  seen: Set<string>,
  depth: number,
  pageUrl: string,
  cssCache: Map<string, string>,
): Promise<string> {
  if (depth >= MAX_IMPORT_DEPTH) return css;
  const importRe = /@import\s+(?:url\()?\s*['"]?([^'")\s;]+)['"]?\s*\)?\s*([^;]*);/g;
  const matches = [...css.matchAll(importRe)];
  if (matches.length === 0) return css;

  for (const m of matches) {
    const raw = m[1];
    let abs: URL;
    try { abs = new URL(raw, base); } catch { continue; }
    const key = abs.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    const text = cssCache.get(key) ?? (await fetchText(key, ACCEPT_CSS, pageUrl));
    if (text === null || text === undefined) continue;
    const rewritten = rewriteCssUrls(text, abs);
    const expanded = await inlineCssImports(rewritten, abs, seen, depth + 1, pageUrl, cssCache);
    css = css.replace(m[0], `\n/* inlined @import: ${raw} */\n${expanded}\n`);
  }
  return css;
}

async function renderPage(targetUrl: string): Promise<{
  html: string;
  finalUrl: string;
  cssCache: Map<string, string>;
}> {
  const browser = await getBrowser();
  const ctx = await browser.newContext({
    viewport: CAPTURE_VIEWPORT,
    deviceScaleFactor: 1,
    userAgent: USER_AGENT,
    extraHTTPHeaders: { "accept-language": "en-US,en;q=0.9" },
  });

  // Cache every CSS response the browser observes during render. We use this
  // to inline external stylesheets later without refetching (avoids cookie
  // / auth / cache-key mismatches that often turn refetches into 403s).
  const cssCache = new Map<string, string>();
  ctx.on("response", async (response) => {
    try {
      const url = response.url();
      const ct = (response.headers()["content-type"] || "").toLowerCase();
      if (ct.includes("text/css") || /\.css(\?|#|$)/i.test(url)) {
        const body = await response.text();
        if (body) cssCache.set(url, body);
      }
    } catch {
      // some responses (preflight, redirects) can't be read — ignore
    }
  });

  let html = "";
  let finalUrl = targetUrl;
  try {
    const page = await ctx.newPage();
    const response = await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 35000,
    });
    if (response && !response.ok() && response.status() >= 400) {
      throw new Error(`Failed to fetch ${targetUrl}: ${response.status()} ${response.statusText()}`);
    }
    finalUrl = page.url();

    // Wait for fonts so layout settles before we serialize.
    try {
      await page.evaluate(
        () => (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts?.ready,
      );
    } catch { /* ignore */ }

    // Best-effort networkidle (analytics & chat widgets often never quiet).
    try { await page.waitForLoadState("networkidle", { timeout: 6000 }); } catch { /* ignore */ }

    // Step-scroll to fire IntersectionObserver-based lazy loaders.
    try {
      await page.evaluate(async () => {
        const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
        const step = 800;
        const max = Math.max(
          document.documentElement.scrollHeight,
          document.body?.scrollHeight ?? 0,
        );
        for (let y = 0; y < max + 800; y += step) {
          window.scrollTo(0, y);
          await sleep(120);
        }
        window.scrollTo(0, 0);
        await sleep(200);
      });
    } catch { /* ignore */ }

    // Catch any newly triggered loads then take the final DOM snapshot.
    try { await page.waitForLoadState("networkidle", { timeout: 4000 }); } catch { /* ignore */ }

    html = await page.content();
  } finally {
    await ctx.close().catch(() => null);
  }

  if (!html) throw new Error("Captured page returned empty content.");
  return { html, finalUrl, cssCache };
}

export async function capturePage(targetUrl: string): Promise<CaptureResult> {
  const { html, finalUrl, cssCache } = await renderPage(targetUrl);
  const base = new URL(finalUrl);
  const pageUrl = base.toString();

  const $ = cheerio.load(html);
  const title = $("title").first().text().trim() || null;

  // 1. Keep <script> so interactive widgets (tabs, accordions, carousels)
  //    work in the preview. We only drop framing elements that could load
  //    arbitrary cross-origin documents inside our sandboxed iframe.
  $("iframe, frame, frameset, embed, object").remove();

  // 2. Strip security headers from the captured doc that would otherwise
  //    block our preview from loading inline styles, fonts, or assets.
  $('meta[http-equiv="Content-Security-Policy"]').remove();
  $('meta[http-equiv="content-security-policy"]').remove();
  $('meta[http-equiv="X-Frame-Options"]').remove();
  $('meta[http-equiv="x-frame-options"]').remove();
  $('meta[http-equiv="refresh"]').remove();

  // 3. Defeat hotlink-protection: send no Referer when loading assets.
  //    A page-level meta is the broadest fix, individual referrerpolicy
  //    attributes are belt-and-braces for older or stricter browsers.
  if ($('meta[name="referrer"]').length === 0) {
    $("head").prepend(`<meta name="referrer" content="no-referrer">`);
  } else {
    $('meta[name="referrer"]').attr("content", "no-referrer");
  }

  // 4. Drop subresource-integrity hashes — they break refetches once we
  //    rewrite or inline the resource.
  $("[integrity]").removeAttr("integrity");
  $("[crossorigin]").removeAttr("crossorigin");

  // 5. Disable form posts and turn anchors into safe new-tab links.
  $("form").each((_, el) => {
    const $el = $(el);
    $el.removeAttr("action").removeAttr("method").attr("onsubmit", "return false");
  });
  $("a[href]").each((_, el) => {
    const $el = $(el);
    const href = $el.attr("href");
    if (!href || href.startsWith("#")) return;
    try {
      $el.attr("href", new URL(href, base).toString());
      $el.attr("target", "_blank");
      $el.attr("rel", "noopener noreferrer");
    } catch {
      $el.removeAttr("href");
    }
  });

  // 6. Absolutize media src/srcset and apply no-referrer per element.
  for (const sel of [
    "img[src]",
    "source[src]",
    "video[src]",
    "audio[src]",
    "video[poster]",
    "img[srcset]",
    "source[srcset]",
  ]) {
    $(sel).each((_, el) => {
      const $el = $(el);
      const src = $el.attr("src");
      if (src) {
        try { $el.attr("src", new URL(src, base).toString()); } catch { /* keep */ }
      }
      const poster = $el.attr("poster");
      if (poster) {
        try { $el.attr("poster", new URL(poster, base).toString()); } catch { /* keep */ }
      }
      const srcset = $el.attr("srcset");
      if (srcset) {
        const rewritten = srcset
          .split(",")
          .map((part) => {
            const trimmed = part.trim();
            if (!trimmed) return "";
            const [u, ...rest] = trimmed.split(/\s+/);
            try { return [new URL(u, base).toString(), ...rest].join(" "); }
            catch { return trimmed; }
          })
          .filter(Boolean)
          .join(", ");
        $el.attr("srcset", rewritten);
      }
      $el.attr("referrerpolicy", "no-referrer");
      // Some lazy-load libraries store the real URL on data-src and only
      // populate src once their JS runs. We removed scripts, so swap it now.
      const dataSrc = $el.attr("data-src");
      if (dataSrc && (!$el.attr("src") || /^data:image\/svg/.test($el.attr("src") ?? ""))) {
        try { $el.attr("src", new URL(dataSrc, base).toString()); } catch { /* keep */ }
      }
      const dataSrcset = $el.attr("data-srcset");
      if (dataSrcset) $el.attr("srcset", dataSrcset);
    });
  }

  // 6b. Absolutize <script src> so external JS loads from upstream.
  $("script[src]").each((_, el) => {
    const $el = $(el);
    const src = $el.attr("src");
    if (!src) return;
    try { $el.attr("src", new URL(src, base).toString()); } catch { /* keep */ }
    $el.attr("referrerpolicy", "no-referrer");
    $el.removeAttr("integrity");
    $el.removeAttr("crossorigin");
  });

  // 7. Absolutize preload / prefetch / modulepreload / icon link hrefs and
  //    apply no-referrer so font CDNs that gate on origin still serve them.
  $('link[href]').each((_, el) => {
    const $el = $(el);
    const rel = ($el.attr("rel") ?? "").toLowerCase();
    const href = $el.attr("href");
    if (!href) return;
    if (["preload", "prefetch", "modulepreload", "icon", "shortcut icon", "apple-touch-icon", "manifest", "stylesheet"].some((r) => rel.includes(r))) {
      try { $el.attr("href", new URL(href, base).toString()); } catch { /* keep */ }
      $el.attr("referrerpolicy", "no-referrer");
    }
  });

  // 8. Inline external stylesheets, recursively follow @import, rewrite urls.
  let cssCount = 0;
  const seenCss = new Set<string>();
  const linkPromises: Promise<void>[] = [];
  $('link[rel="stylesheet"][href]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr("href");
    if (!href) return;
    let cssUrl: URL;
    try { cssUrl = new URL(href, base); } catch { return; }
    if (seenCss.has(cssUrl.toString())) {
      $el.remove();
      return;
    }
    seenCss.add(cssUrl.toString());
    const media = $el.attr("media");
    linkPromises.push(
      (async () => {
        // Prefer the response Chromium already loaded — same cookies, same
        // cache key the browser actually used to render the page.
        const css =
          cssCache.get(cssUrl.toString()) ??
          (await fetchText(cssUrl.toString(), ACCEPT_CSS, pageUrl));
        if (css === null || css === undefined) return;
        const rewritten = rewriteCssUrls(css, cssUrl);
        const expanded = await inlineCssImports(rewritten, cssUrl, seenCss, 0, pageUrl, cssCache);
        const mediaAttr = media ? ` media="${media}"` : "";
        $el.replaceWith(
          `<style data-origin="${cssUrl.toString()}"${mediaAttr}>\n${expanded}\n</style>`,
        );
        cssCount++;
      })(),
    );
  });

  // 9. Rewrite urls inside existing <style> blocks (relative to page URL)
  //    AND follow their @imports.
  const stylePromises: Promise<void>[] = [];
  $("style").each((_, el) => {
    const $el = $(el);
    if ($el.attr("data-origin")) return; // queued above, will be handled
    stylePromises.push(
      (async () => {
        const css = $el.html() ?? "";
        const rewritten = rewriteCssUrls(css, base);
        const expanded = await inlineCssImports(rewritten, base, seenCss, 0, pageUrl, cssCache);
        $el.html(expanded);
      })(),
    );
  });

  await Promise.all([...linkPromises, ...stylePromises]);

  // 10. Inject <base> as a final safety net for any remaining relative URLs.
  if ($("head base").length === 0) {
    $("head").prepend(`<base href="${pageUrl}">`);
  }

  // 11. Mark the document as a captured snapshot.
  $("head").append(`<meta name="x-seo-manager-capture" content="${pageUrl}">`);

  // 12. Broken-image placeholder — applied only to images that actually fail
  //     to load. A tiny bootstrap script tags failed images via the error
  //     event (capture phase, since `error` doesn't bubble); CSS below then
  //     paints a hairline placeholder only on tagged elements. Images that
  //     load normally render unchanged.
  const placeholderSvg =
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='%23bdbdbd' stroke-width='1.4' stroke-linecap='square' stroke-linejoin='miter'><rect x='3' y='3' width='18' height='18'/><circle cx='8.5' cy='8.5' r='1.4' fill='%23bdbdbd' stroke='none'/><path d='M21 15l-5-5L5 21'/></svg>";
  $("head").prepend(
    `<style data-injected="seo-manager-placeholders">
img.seo-mgr-broken-img { background-color: #f4f4f4; background-image: url("${placeholderSvg}"); background-position: center; background-repeat: no-repeat; background-size: 40px 40px; min-height: 60px; min-width: 60px; color: #888; font-size: 11px; line-height: 1.3; word-break: break-word; }
img[src=""], img:not([src]) { background-color: #f4f4f4; min-height: 60px; min-width: 60px; }
.seo-mgr-rewrite-flash { animation: seoMgrRewriteFlash 1100ms ease-out; }
@keyframes seoMgrRewriteFlash { 0% { background-color: rgba(245, 158, 11, 0.18); } 100% { background-color: transparent; } }
</style>
<script data-injected="seo-manager-bootstrap">
(function(){
  // -- broken image tagging --
  function tagBroken(t){ if(t && t.tagName === 'IMG'){ t.classList.add('seo-mgr-broken-img'); } }
  document.addEventListener('error', function(e){ tagBroken(e.target); }, true);
  document.addEventListener('DOMContentLoaded', function(){
    document.querySelectorAll('img').forEach(function(img){
      if (img.complete && img.naturalWidth === 0 && (img.getAttribute('src') || '').length > 0) tagBroken(img);
    });
  });

  // -- live text-rewrite via postMessage from parent --
  // Walks the section in the SAME order the server walked it (cheerio's
  // contents() yields the same sequence as DOM childNodes), so each text
  // node maps to the same numeric id on both sides. Whitespace is preserved
  // around the replacement so layout doesn't shift.
  var SKIP = { SCRIPT:1, STYLE:1, NOSCRIPT:1, CODE:1, PRE:1, SVG:1, MATH:1, TEMPLATE:1, META:1, LINK:1 };
  function collectTextNodes(root) {
    var out = [];
    function walk(el) {
      var children = el.childNodes;
      for (var i = 0; i < children.length; i++) {
        var c = children[i];
        if (c.nodeType === 3) {
          var raw = c.nodeValue || '';
          var trimmed = raw.replace(/^\\s+|\\s+$/g, '');
          if (trimmed.length < 2) continue;
          if (!/[\\p{L}]/u.test(trimmed)) continue;
          out.push(c);
        } else if (c.nodeType === 1 && !SKIP[c.tagName]) {
          walk(c);
        }
      }
    }
    walk(root);
    return out;
  }
  window.addEventListener('message', function(e) {
    var data = e && e.data;
    if (!data || data.type !== 'seo-mgr-apply') return;
    var root = document.querySelector(data.selector);
    if (!root) return;
    var nodes = collectTextNodes(root);
    var items = data.items || [];
    var changedParents = new Set();
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var node = nodes[it.id];
      if (!node) continue;
      var orig = node.nodeValue || '';
      var lead = (orig.match(/^\\s*/) || [''])[0];
      var trail = (orig.match(/\\s*$/) || [''])[0];
      var next = lead + (it.text || '') + trail;
      if (next === orig) continue;
      node.nodeValue = next;
      if (node.parentElement) changedParents.add(node.parentElement);
    }
    // Subtle flash on changed parents so the user can see what just updated.
    changedParents.forEach(function(p){
      p.classList.remove('seo-mgr-rewrite-flash');
      // force reflow to restart the animation
      void p.offsetWidth;
      p.classList.add('seo-mgr-rewrite-flash');
    });
    // Briefly highlight the section frame so the user can locate the change.
    try {
      root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (_) { /* ignore */ }
  });
})();
</script>`,
  );

  return { html: $.html(), title, cssCount };
}

export function isLikelyHtmlDocument(text: string): boolean {
  return /<html[\s>]/i.test(text) || /<!doctype/i.test(text);
}
