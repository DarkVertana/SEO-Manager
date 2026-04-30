"use client";

import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import type { RewriteRun } from "./RewriteWorkspace";
import { sanitizeForPdf } from "./_sanitize";

// Same Swiss typography as the audit PDF — Geist + Geist Mono vendored under
// /public/fonts so generation works offline.
const FONT_SANS = "Geist";
const FONT_MONO = "Geist Mono";

let registered = false;
function ensureFontsRegistered() {
  if (registered) return;
  registered = true;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  Font.register({
    family: FONT_SANS,
    fonts: [
      { src: `${origin}/fonts/Geist-Regular.ttf`, fontWeight: 400 },
      { src: `${origin}/fonts/Geist-Medium.ttf`, fontWeight: 500 },
      { src: `${origin}/fonts/Geist-Bold.ttf`, fontWeight: 700 },
    ],
  });
  Font.register({
    family: FONT_MONO,
    fonts: [
      { src: `${origin}/fonts/GeistMono-Regular.ttf`, fontWeight: 400 },
      { src: `${origin}/fonts/GeistMono-Medium.ttf`, fontWeight: 500 },
    ],
  });
  // Soft-break long unbreakable strings so URLs and dotted code paths don't
  // overflow the page width and produce impossible layout coordinates
  // ("unsupported number: -1.9e+21" etc). Strategy:
  //   - short words pass through untouched
  //   - longer words split at common separators (/, -, _, ., ,, ?, &, =, :)
  //   - tokens still longer than 24 chars after that hard-break every 24
  Font.registerHyphenationCallback((word) => {
    if (word.length <= 24) return [word];
    const softParts = word.split(/([/\-_.,?&=:])/g).filter(Boolean);
    const out: string[] = [];
    for (const part of softParts) {
      if (part.length <= 24) {
        out.push(part);
      } else {
        for (let i = 0; i < part.length; i += 24) {
          out.push(part.slice(i, i + 24));
        }
      }
    }
    return out;
  });
}

const COLORS = {
  fg: "#0a0a0a",
  bg: "#ffffff",
  muted: "#737373",
  hairline: "#d4d4d4",
  accent: "#e11d2e",
  emerald: "#047857",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontFamily: FONT_SANS,
    fontSize: 9.5,
    color: COLORS.fg,
    lineHeight: 1.5,
  },
  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.hairline,
    marginBottom: 24,
  },
  pageFooter: {
    position: "absolute",
    bottom: 28,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.hairline,
    fontSize: 7.5,
    color: COLORS.muted,
    letterSpacing: 1.2,
  },
  eyebrow: {
    fontSize: 7.5,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: COLORS.muted,
    fontWeight: 500,
  },
  h1: {
    fontSize: 32,
    fontWeight: 500,
    letterSpacing: -0.5,
    marginTop: 4,
    marginBottom: 16,
  },
  h2: {
    fontSize: 16,
    fontWeight: 500,
    marginBottom: 6,
  },
  h3: {
    fontSize: 12,
    fontWeight: 500,
    marginBottom: 4,
  },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: COLORS.hairline,
    marginBottom: 28,
  },
  metaItem: {
    minWidth: 120,
  },
  runBlock: {
    marginBottom: 28,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.hairline,
    paddingTop: 14,
  },
  runHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 6,
  },
  promptLabel: {
    fontSize: 7.5,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: COLORS.muted,
    marginTop: 6,
  },
  promptText: {
    fontFamily: FONT_MONO,
    fontSize: 9,
    backgroundColor: "#fafafa",
    borderWidth: 0.5,
    borderColor: COLORS.hairline,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  sectionBlock: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.hairline,
  },
  sectionTitle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 500,
  },
  sectionMeta: {
    fontSize: 8,
    color: COLORS.muted,
    fontFamily: FONT_MONO,
  },
  diffRow: {
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.hairline,
  },
  diffNum: {
    fontSize: 7.5,
    color: COLORS.muted,
    fontFamily: FONT_MONO,
    marginBottom: 2,
  },
  beforeLabel: {
    fontSize: 7,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: COLORS.accent,
    marginBottom: 1,
  },
  afterLabel: {
    fontSize: 7,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: COLORS.emerald,
    marginTop: 4,
    marginBottom: 1,
  },
  beforeText: { fontSize: 9 },
  afterText: { fontSize: 9 },
  // No `fontStyle: "italic"` — we don't ship a Geist Italic face in
  // /public/fonts, and react-pdf throws "Could not resolve font for Geist,
  // fontWeight 400, fontStyle italic" the moment any italic text is rendered.
  // That single error aborts the whole PDF, which is why multi-section runs
  // (more sections → higher chance a section has zero replacements → empty
  // state fires → italic crashes) failed while a clean single-section run
  // happened to slip through.
  empty: {
    color: COLORS.muted,
    fontSize: 9,
  },
});

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type RewriteSummaryProps = {
  url: string;
  pageTitle: string | null;
  generatedAt: string;
  runs: RewriteRun[];
};

export function RewriteSummaryDocument({
  url,
  pageTitle,
  generatedAt,
  runs,
}: RewriteSummaryProps) {
  ensureFontsRegistered();
  const totalSections = runs.reduce((s, r) => s + r.sections.length, 0);
  const totalReplacements = runs.reduce(
    (s, r) => s + r.sections.reduce((ss, sec) => ss + sec.replacements.length, 0),
    0,
  );

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.pageHeader} fixed>
          <Text style={styles.eyebrow}>SEO MANAGER · REWRITE SUMMARY</Text>
          <Text style={styles.eyebrow}>{formatTimestamp(generatedAt)}</Text>
        </View>

        <Text style={styles.eyebrow}>— Rewrite hand-off</Text>
        <Text style={styles.h1}>{sanitizeForPdf(pageTitle ?? url)}</Text>

        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <Text style={styles.eyebrow}>Source URL</Text>
            <Text style={{ fontFamily: FONT_MONO, fontSize: 8 }}>{sanitizeForPdf(url)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.eyebrow}>Runs</Text>
            <Text style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 500 }}>
              {runs.length}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.eyebrow}>Sections touched</Text>
            <Text style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 500 }}>
              {totalSections}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.eyebrow}>Text replacements</Text>
            <Text style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 500 }}>
              {totalReplacements}
            </Text>
          </View>
        </View>

        {runs.length === 0 ? (
          <Text style={styles.empty}>— No rewrites have been recorded yet.</Text>
        ) : (
          runs.map((run, ri) => (
            <View key={ri} style={styles.runBlock} wrap>
              <View style={styles.runHeader}>
                <Text style={styles.h2}>Run {String(ri + 1).padStart(2, "0")}</Text>
                <Text style={styles.sectionMeta}>{formatTimestamp(run.startedAt)}</Text>
              </View>
              <Text style={styles.promptLabel}>Instruction</Text>
              <Text style={styles.promptText}>{sanitizeForPdf(run.prompt)}</Text>

              {run.sections.length === 0 ? (
                <Text style={styles.empty}>— No sections completed in this run.</Text>
              ) : (
                run.sections.map((sec, si) => (
                  <View key={si} style={styles.sectionBlock} wrap>
                    <View style={styles.sectionTitle}>
                      <Text style={styles.sectionLabel}>
                        @section{sec.index + 1}
                        {sec.heading ? ` · ${sanitizeForPdf(sec.heading)}` : ""}
                      </Text>
                      <Text style={styles.sectionMeta}>
                        {sec.replacements.length} change{sec.replacements.length === 1 ? "" : "s"}
                      </Text>
                    </View>

                    {sec.replacements.length === 0 ? (
                      <Text style={styles.empty}>— No text changed in this section.</Text>
                    ) : (
                      sec.replacements.map((rep, idx) => (
                        <View key={idx} style={styles.diffRow} wrap={false}>
                          <Text style={styles.diffNum}>
                            #{String(idx + 1).padStart(2, "0")} (id {rep.id})
                          </Text>
                          <Text style={styles.beforeLabel}>Before</Text>
                          <Text style={styles.beforeText}>{sanitizeForPdf(rep.before)}</Text>
                          <Text style={styles.afterLabel}>=</Text>
                          <Text style={styles.afterText}>{sanitizeForPdf(rep.text)}</Text>
                        </View>
                      ))
                    )}
                  </View>
                ))
              )}
            </View>
          ))
        )}

        <View style={styles.pageFooter} fixed>
          <Text>SEO MANAGER · REWRITE SUMMARY</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${String(pageNumber).padStart(2, "0")} / ${String(totalPages).padStart(2, "0")}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
