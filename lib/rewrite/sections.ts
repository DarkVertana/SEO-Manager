// Section detection. Goal: identify header (skip), footer (skip), and the
// main content sections in between so we can rewrite them one at a time.
//
// Strategy:
// 1. Header  = <header role=banner> | first <header> | first <nav> as direct child of body | first body child if it looks like a hero+nav block.
// 2. Footer  = <footer> | last body child if it looks like a footer (links + copyright).
// 3. Sections = <main> direct children → <section>/<article> elements → top-level body element children that aren't header/footer.
//
// We tag each section with `data-rewrite-section="<index>"` and skip-zones
// with `data-rewrite-skip="header"|"footer"`. The captured HTML on disk is
// re-saved with these markers so subsequent runs reuse them.

import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";

export const SECTION_ATTR = "data-rewrite-section";
export const SKIP_ATTR = "data-rewrite-skip";
const MIN_SECTION_TEXT = 30; // chars of trimmed text in a section

export type SectionInfo = {
  index: number;
  selector: string;
  textCount: number;
};

function isLikelyFooter($el: cheerio.Cheerio<AnyNode>): boolean {
  const text = $el.text().toLowerCase();
  return /©|copyright|all rights reserved|terms|privacy/.test(text);
}

function findHeader($: cheerio.CheerioAPI): cheerio.Cheerio<AnyNode> | null {
  const explicit = $('header[role="banner"], body > header, body > main > header').first();
  if (explicit.length) return explicit;
  // Top-level <nav>, including the common case where the page is wrapped in
  // a single container div (`body > div.page > nav`). Match the nav itself,
  // never the wrapping container — wrapping the entire wrapper used to swallow
  // the hero / first content section into the skip zone.
  const topNav = $(
    "body > nav, body > main > nav, body > div > nav, body > main > div > nav",
  ).first();
  if (topNav.length) return topNav;
  return null;
}

function findFooter($: cheerio.CheerioAPI): cheerio.Cheerio<AnyNode> | null {
  const explicit = $("footer").last();
  if (explicit.length) return explicit;
  const lastChild = $("body").children().last();
  if (lastChild.length && isLikelyFooter(lastChild)) return lastChild;
  return null;
}

function pickSectionContainers($: cheerio.CheerioAPI): cheerio.Cheerio<AnyNode> {
  const main = $("main").first();
  if (main.length) {
    const children = main.children().filter((_, el) => el.type === "tag");
    if (children.length >= 2) return children;
  }
  const sections = $("section, article");
  if (sections.length >= 2) return sections;
  return $("body").children().filter((_, el) => el.type === "tag");
}

export function tagSections(html: string): { html: string; sections: SectionInfo[] } {
  const $ = cheerio.load(html);

  const header = findHeader($);
  const footer = findFooter($);
  if (header) header.attr(SKIP_ATTR, "header");
  if (footer) footer.attr(SKIP_ATTR, "footer");

  const candidates = pickSectionContainers($);
  const sections: SectionInfo[] = [];

  candidates.each((_, el) => {
    const $el = $(el);
    if ($el.attr(SKIP_ATTR)) return;
    if (header && $el.is(header)) return;
    if (footer && $el.is(footer)) return;
    // Skip if this element is contained inside header/footer
    if (header && $el.parents().is(header)) return;
    if (footer && $el.parents().is(footer)) return;

    const text = $el.text().trim();
    if (text.length < MIN_SECTION_TEXT) return;

    const index = sections.length;
    $el.attr(SECTION_ATTR, String(index));
    sections.push({
      index,
      selector: `[${SECTION_ATTR}="${index}"]`,
      textCount: text.length,
    });
  });

  return { html: $.html(), sections };
}

export function listSections(html: string): SectionInfo[] {
  const $ = cheerio.load(html);
  const out: SectionInfo[] = [];
  $(`[${SECTION_ATTR}]`).each((_, el) => {
    const idx = Number($(el).attr(SECTION_ATTR));
    if (Number.isNaN(idx)) return;
    out.push({
      index: idx,
      selector: `[${SECTION_ATTR}="${idx}"]`,
      textCount: $(el).text().trim().length,
    });
  });
  return out.sort((a, b) => a.index - b.index);
}
