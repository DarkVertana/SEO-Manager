"use client";

import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import type { AuditReport, CategoryReport, Issue, PageReport, Priority } from "@/lib/seo/types";

// Swiss typography: Geist + Geist Mono (Vercel's open-source neo-grotesque,
// designed in the Swiss tradition). The TTFs are vendored under /public/fonts
// so generation works offline with no remote fetches.
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
  // Fix hyphenation: react-pdf's default hyphenation breaks long URLs awkwardly.
  Font.registerHyphenationCallback((word) => [word]);
}

const COLORS = {
  fg: "#0a0a0a",
  bg: "#ffffff",
  muted: "#737373",
  hairline: "#d4d4d4",
  accent: "#e11d2e",
  emerald: "#047857",
  amber: "#b45309",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontFamily: FONT_SANS,
    fontSize: 9.5,
    color: COLORS.fg,
    lineHeight: 1.5,
  },
  // Header / footer
  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.hairline,
    marginBottom: 28,
  },
  pageFooter: {
    position: "absolute",
    bottom: 28,
    left: 56,
    right: 56,
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
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: COLORS.muted,
    fontWeight: 500,
  },
  // Hero score
  hero: {
    flexDirection: "row",
    marginBottom: 32,
  },
  heroLeft: { flex: 5, paddingRight: 24 },
  heroRight: {
    flex: 7,
    borderLeftWidth: 0.5,
    borderLeftColor: COLORS.hairline,
    paddingLeft: 24,
  },
  heroScore: {
    fontFamily: FONT_MONO,
    fontSize: 96,
    fontWeight: 500,
    letterSpacing: -2,
    lineHeight: 1,
  },
  heroSlash: {
    fontSize: 14,
    color: COLORS.muted,
    marginLeft: 6,
  },
  headline: {
    fontSize: 28,
    fontWeight: 500,
    letterSpacing: -0.5,
    marginTop: 14,
    lineHeight: 1.1,
  },
  summary: {
    fontSize: 9.5,
    marginTop: 14,
    lineHeight: 1.55,
    maxWidth: 380,
  },
  // Score table
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.hairline,
  },
  scoreLabel: { flex: 5, fontSize: 9 },
  scoreWeight: {
    flex: 2,
    fontSize: 7.5,
    color: COLORS.muted,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  scoreBarWrap: { flex: 3, height: 2, backgroundColor: COLORS.hairline },
  scoreBar: { height: 2 },
  scoreValue: {
    flex: 2,
    fontFamily: FONT_MONO,
    fontSize: 10,
    textAlign: "right",
  },
  scoreValueMuted: { color: COLORS.muted, fontSize: 7.5 },
  // Stats strip
  statsStrip: {
    flexDirection: "row",
    paddingVertical: 14,
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: COLORS.hairline,
    marginBottom: 28,
  },
  stat: { flex: 1, paddingRight: 8 },
  statValue: { fontSize: 13, fontWeight: 500, marginTop: 4 },
  statSub: { fontSize: 7.5, color: COLORS.muted, marginTop: 2 },
  // Section header
  section: { marginTop: 24, marginBottom: 8 },
  sectionEyebrow: {
    fontSize: 7.5,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: COLORS.muted,
    fontWeight: 500,
    marginBottom: 8,
  },
  sectionRule: {
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.hairline,
    marginBottom: 4,
  },
  // Issue
  issueRow: {
    flexDirection: "row",
    paddingVertical: 9,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.hairline,
  },
  issueLeft: { width: 88, paddingRight: 8 },
  priorityBadge: {
    fontSize: 7,
    paddingVertical: 2,
    paddingHorizontal: 5,
    letterSpacing: 1.4,
    alignSelf: "flex-start",
    color: COLORS.bg,
    backgroundColor: COLORS.fg,
  },
  priorityCritical: { backgroundColor: COLORS.accent, color: "#ffffff" },
  priorityMedium: {
    backgroundColor: "transparent",
    color: COLORS.fg,
    borderWidth: 0.5,
    borderColor: COLORS.fg,
  },
  priorityLow: {
    backgroundColor: "transparent",
    color: COLORS.muted,
    borderWidth: 0.5,
    borderColor: COLORS.hairline,
  },
  issueCategoryEyebrow: {
    fontSize: 7,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: COLORS.muted,
    marginTop: 6,
  },
  issueRight: { flex: 1 },
  issueTitle: { fontSize: 9.5, fontWeight: 500 },
  issueDesc: { fontSize: 9, color: COLORS.muted, marginTop: 3, lineHeight: 1.5 },
  issueFix: { fontSize: 9, marginTop: 5, lineHeight: 1.5 },
  // Category block
  catHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.hairline,
  },
  catNum: { width: 36, fontSize: 7.5, color: COLORS.muted, fontFamily: FONT_MONO },
  catGlyph: { width: 16, fontSize: 11 },
  catTitle: { flex: 1, fontSize: 10, fontWeight: 500 },
  catScore: {
    fontFamily: FONT_MONO,
    fontSize: 11,
    textAlign: "right",
  },
  catBody: {
    paddingTop: 6,
    paddingBottom: 12,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.hairline,
  },
  catSummary: { fontSize: 9, lineHeight: 1.55, marginBottom: 8, maxWidth: 460 },
  findingsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  finding: {
    width: "50%",
    paddingVertical: 3,
    paddingLeft: 8,
    borderLeftWidth: 0.5,
    borderLeftColor: COLORS.hairline,
    paddingRight: 12,
    flexDirection: "row",
    fontSize: 8.5,
    marginBottom: 3,
  },
  findingGlyph: { width: 12 },
  // Eeat grid
  eeatGrid: { flexDirection: "row", marginTop: 6, marginBottom: 14, gap: 6 },
  eeatCard: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: COLORS.hairline,
    padding: 8,
  },
  eeatCardHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.hairline,
  },
  // JSON-LD
  codeBlock: {
    fontFamily: FONT_MONO,
    fontSize: 7.5,
    lineHeight: 1.5,
    padding: 8,
    borderWidth: 0.5,
    borderColor: COLORS.hairline,
    backgroundColor: "#fafafa",
    marginTop: 6,
  },
});

const STATUS_COLOR = {
  pass: COLORS.emerald,
  warn: COLORS.amber,
  fail: COLORS.accent,
} as const;

function StatusDot({
  status,
  size = 7,
}: {
  status: "pass" | "warn" | "fail";
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        marginRight: 6,
        backgroundColor: STATUS_COLOR[status],
      }}
    />
  );
}

const PRIORITY_ORDER: Priority[] = ["Critical", "High", "Medium", "Low"];

function priorityStyle(priority: Priority) {
  if (priority === "Critical") return [styles.priorityBadge, styles.priorityCritical];
  if (priority === "High") return [styles.priorityBadge];
  if (priority === "Medium") return [styles.priorityBadge, styles.priorityMedium];
  return [styles.priorityBadge, styles.priorityLow];
}

function barColor(value: number): string {
  return value >= 80 ? COLORS.emerald : value >= 60 ? COLORS.amber : COLORS.accent;
}

function ScoreLine({ label, value, weight }: { label: string; value: number; weight?: string }) {
  return (
    <View style={styles.scoreRow}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <Text style={styles.scoreWeight}>{weight ?? ""}</Text>
      <View style={styles.scoreBarWrap}>
        <View style={[styles.scoreBar, { width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: barColor(value) }]} />
      </View>
      <Text style={styles.scoreValue}>
        {value}
        <Text style={styles.scoreValueMuted}>/100</Text>
      </Text>
    </View>
  );
}

function PdfHeader({ url, command }: { url: string; command: string }) {
  return (
    <View style={styles.pageHeader} fixed>
      <Text style={styles.eyebrow}>SEO / MANAGER · /seo {command}</Text>
      <Text style={[styles.eyebrow, { maxWidth: 320, textAlign: "right" }]}>
        {url.length > 60 ? `${url.slice(0, 57)}…` : url}
      </Text>
    </View>
  );
}

function PdfFooter({ generatedAt }: { generatedAt: string }) {
  return (
    <View style={styles.pageFooter} fixed>
      <Text>SEO MANAGER · {generatedAt}</Text>
      <Text
        render={({ pageNumber, totalPages }) =>
          `${String(pageNumber).padStart(2, "0")} / ${String(totalPages).padStart(2, "0")}`
        }
      />
    </View>
  );
}

function IssueRow({ issue }: { issue: Issue }) {
  return (
    <View style={styles.issueRow} wrap={false}>
      <View style={styles.issueLeft}>
        <Text style={priorityStyle(issue.priority)}>{issue.priority.toUpperCase()}</Text>
        <Text style={styles.issueCategoryEyebrow}>{issue.category}</Text>
        {issue.effort && (
          <Text style={[styles.issueCategoryEyebrow, { textTransform: "none", letterSpacing: 0 }]}>
            effort: {issue.effort}
          </Text>
        )}
      </View>
      <View style={styles.issueRight}>
        <Text style={styles.issueTitle}>{issue.title}</Text>
        <Text style={styles.issueDesc}>{issue.description}</Text>
        <Text style={styles.issueFix}>
          <Text style={{ fontWeight: 500 }}>Fix: </Text>
          {issue.recommendation}
        </Text>
      </View>
    </View>
  );
}

function CategoryBlock({
  index,
  title,
  report,
}: {
  index: string;
  title: string;
  report: CategoryReport;
}) {
  return (
    <View wrap>
      <View style={styles.catHeader}>
        <Text style={styles.catNum}>{index}</Text>
        <View style={styles.catGlyph}>
          <StatusDot status={report.status} size={9} />
        </View>
        <Text style={styles.catTitle}>{title}</Text>
        <Text style={styles.catScore}>
          {report.score}
          <Text style={styles.scoreValueMuted}>/100</Text>
        </Text>
      </View>
      <View style={styles.catBody}>
        <Text style={styles.catSummary}>{report.summary}</Text>
        {report.findings.length > 0 && (
          <View style={styles.findingsGrid}>
            {report.findings.map((f, i) => (
              <View key={i} style={styles.finding} wrap={false}>
                <View style={styles.findingGlyph}>
                  <StatusDot status={f.status} />
                </View>
                <Text>
                  <Text style={{ fontWeight: 500 }}>{f.label}</Text>
                  {f.detail ? (
                    <Text style={{ color: COLORS.muted }}> — {f.detail}</Text>
                  ) : null}
                </Text>
              </View>
            ))}
          </View>
        )}
        {report.issues.length > 0 && (
          <View style={{ marginTop: 4 }}>
            <Text style={[styles.eyebrow, { marginBottom: 4 }]}>Issues</Text>
            {report.issues.map((issue, i) => (
              <IssueRow key={i} issue={issue} />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function HeaderHero({
  url,
  industry,
  pageType,
  date,
}: {
  url: string;
  industry: string;
  pageType: string;
  date: string;
}) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={styles.eyebrow}>— SEO Audit Report</Text>
      <Text style={[styles.headline, { marginTop: 8 }]}>{url}</Text>
      <View style={styles.statsStrip}>
        <View style={styles.stat}>
          <Text style={styles.eyebrow}>Industry</Text>
          <Text style={styles.statValue}>{industry}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.eyebrow}>Page Type</Text>
          <Text style={styles.statValue}>{pageType}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.eyebrow}>Date</Text>
          <Text style={styles.statValue}>{date}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.eyebrow}>Method</Text>
          <Text style={styles.statValue}>7-agent audit</Text>
        </View>
      </View>
    </View>
  );
}

function SectionEyebrow({ children }: { children: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionEyebrow}>— {children}</Text>
      <View style={styles.sectionRule} />
    </View>
  );
}

/* ---------- Audit document ---------- */

export function AuditPdfDocument({
  record,
  generatedAt,
}: {
  record: {
    url: string;
    command: string;
    industry: string | null;
    createdAt: string;
    report: AuditReport | PageReport;
  };
  generatedAt: string;
}) {
  ensureFontsRegistered();
  if (record.report.command === "audit") {
    return <AuditDoc record={record as { url: string; command: string; industry: string | null; createdAt: string; report: AuditReport }} generatedAt={generatedAt} />;
  }
  return <PageDoc record={record as { url: string; command: string; industry: string | null; createdAt: string; report: PageReport }} generatedAt={generatedAt} />;
}

function AuditDoc({
  record,
  generatedAt,
}: {
  record: { url: string; command: string; industry: string | null; createdAt: string; report: AuditReport };
  generatedAt: string;
}) {
  const a = record.report;
  const totalIssues = Object.values(a.categories).reduce(
    (acc: number, c) => acc + (c.issues?.length ?? 0),
    0,
  );
  const date = new Date(record.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <PdfHeader url={record.url} command={record.command} />
        <PdfFooter generatedAt={generatedAt} />

        <HeaderHero
          url={record.url}
          industry={a.industry.industry}
          pageType={a.industry.pageType}
          date={date}
        />

        <View style={styles.hero}>
          <View style={styles.heroLeft}>
            <Text style={styles.eyebrow}>— 01 / Health Score</Text>
            <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: 6 }}>
              <Text style={styles.heroScore}>{a.overallScore}</Text>
              <Text style={styles.heroSlash}>/100</Text>
            </View>
            <Text style={styles.summary}>{a.executiveSummary}</Text>
          </View>
          <View style={styles.heroRight}>
            <Text style={styles.eyebrow}>Weighted breakdown</Text>
            <View style={{ marginTop: 6 }}>
              <ScoreLine label="Technical SEO" value={a.scores.technical} weight="22%" />
              <ScoreLine label="Content Quality" value={a.scores.content} weight="23%" />
              <ScoreLine label="On-Page SEO" value={a.scores.onPage} weight="20%" />
              <ScoreLine label="Schema / Structured Data" value={a.scores.schema} weight="10%" />
              <ScoreLine label="Performance / CWV" value={a.scores.performance} weight="10%" />
              <ScoreLine label="AI Search Readiness" value={a.scores.aiSearchReadiness} weight="10%" />
              <ScoreLine label="Images" value={a.scores.images} weight="05%" />
            </View>
          </View>
        </View>

        <View style={styles.statsStrip}>
          <View style={styles.stat}>
            <Text style={styles.eyebrow}>Industry</Text>
            <Text style={styles.statValue}>{a.industry.industry}</Text>
            <Text style={styles.statSub}>{a.industry.confidence} confidence</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.eyebrow}>Page Type</Text>
            <Text style={styles.statValue}>{a.industry.pageType}</Text>
            <Text style={styles.statSub}>Detected</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.eyebrow}>Issues</Text>
            <Text style={styles.statValue}>{totalIssues}</Text>
            <Text style={styles.statSub}>Total findings</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.eyebrow}>Critical</Text>
            <Text style={styles.statValue}>{a.topCriticalIssues.length}</Text>
            <Text style={styles.statSub}>Immediate fixes</Text>
          </View>
        </View>

        {a.topCriticalIssues.length > 0 && (
          <View>
            <SectionEyebrow>02 / Top Critical Issues</SectionEyebrow>
            {a.topCriticalIssues.map((i, idx) => <IssueRow key={idx} issue={i} />)}
          </View>
        )}

        {a.topQuickWins.length > 0 && (
          <View>
            <SectionEyebrow>03 / Top Quick Wins</SectionEyebrow>
            {a.topQuickWins.map((i, idx) => <IssueRow key={idx} issue={i} />)}
          </View>
        )}
      </Page>

      <Page size="A4" style={styles.page}>
        <PdfHeader url={record.url} command={record.command} />
        <PdfFooter generatedAt={generatedAt} />

        <SectionEyebrow>04 / Category Breakdown</SectionEyebrow>
        <CategoryBlock index="04.1" title="Technical SEO" report={a.categories.technical} />
        <CategoryBlock index="04.2" title="Content Quality + E-E-A-T" report={a.categories.content} />
        <CategoryBlock index="04.3" title="On-Page SEO" report={a.categories.onPage} />
        <CategoryBlock index="04.4" title="Schema / Structured Data" report={a.categories.schema} />
        <CategoryBlock index="04.5" title="Performance / Core Web Vitals" report={a.categories.performance} />
        <CategoryBlock index="04.6" title="AI Search Readiness (GEO)" report={a.categories.aiSearchReadiness} />
        <CategoryBlock index="04.7" title="Images" report={a.categories.images} />

        <SectionEyebrow>05 / E-E-A-T Breakdown</SectionEyebrow>
        <View style={styles.eeatGrid}>
          {(Object.keys(a.categories.content.eeat) as (keyof typeof a.categories.content.eeat)[]).map((k) => (
            <View key={k} style={styles.eeatCard} wrap={false}>
              <View style={styles.eeatCardHead}>
                <Text style={styles.eyebrow}>{k}</Text>
                <Text style={styles.scoreValue}>
                  {a.categories.content.eeat[k].score}
                  <Text style={styles.scoreValueMuted}>/100</Text>
                </Text>
              </View>
              <View style={{ marginTop: 4 }}>
                {a.categories.content.eeat[k].signals.map((s, i) => (
                  <Text key={i} style={{ fontSize: 8, color: COLORS.muted, marginTop: 2 }}>
                    · {s}
                  </Text>
                ))}
              </View>
            </View>
          ))}
        </View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            paddingTop: 6,
            borderTopWidth: 0.5,
            borderTopColor: COLORS.hairline,
          }}
        >
          <Text style={styles.eyebrow}>AI Citation Readiness</Text>
          <Text style={styles.scoreValue}>
            {a.categories.content.aiCitationReadiness}
            <Text style={styles.scoreValueMuted}>/100</Text>
          </Text>
        </View>

        {a.categories.schema.suggestions.length > 0 && (
          <View>
            <SectionEyebrow>06 / Schema Suggestions (JSON-LD)</SectionEyebrow>
            {a.categories.schema.suggestions.map((snippet, i) => (
              <View key={i} style={styles.codeBlock} wrap>
                <Text>{snippet}</Text>
              </View>
            ))}
          </View>
        )}
      </Page>

      <Page size="A4" style={styles.page}>
        <PdfHeader url={record.url} command={record.command} />
        <PdfFooter generatedAt={generatedAt} />

        <SectionEyebrow>07 / Prioritized Action Plan</SectionEyebrow>
        {PRIORITY_ORDER.map((p) => {
          const bucket = a.actionPlan.find((b) => b.priority === p);
          if (!bucket || bucket.items.length === 0) return null;
          return (
            <View key={p} wrap>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingTop: 8,
                  paddingBottom: 4,
                  borderTopWidth: 0.5,
                  borderTopColor: COLORS.hairline,
                  gap: 8,
                }}
              >
                <Text style={priorityStyle(p)}>{p.toUpperCase()}</Text>
                <Text style={[styles.eyebrow, { textTransform: "none", letterSpacing: 0 }]}>
                  {bucket.items.length} item{bucket.items.length === 1 ? "" : "s"}
                </Text>
              </View>
              {bucket.items.map((issue, i) => (
                <IssueRow key={i} issue={issue} />
              ))}
            </View>
          );
        })}
      </Page>
    </Document>
  );
}

function PageDoc({
  record,
  generatedAt,
}: {
  record: { url: string; command: string; industry: string | null; createdAt: string; report: PageReport };
  generatedAt: string;
}) {
  const r = record.report;
  const date = new Date(record.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <PdfHeader url={record.url} command={record.command} />
        <PdfFooter generatedAt={generatedAt} />

        <HeaderHero
          url={record.url}
          industry={r.industry.industry}
          pageType={r.industry.pageType}
          date={date}
        />

        <View style={styles.hero}>
          <View style={styles.heroLeft}>
            <Text style={styles.eyebrow}>— 01 / Page Score</Text>
            <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: 6 }}>
              <Text style={styles.heroScore}>{r.overallScore}</Text>
              <Text style={styles.heroSlash}>/100</Text>
            </View>
            <Text style={styles.summary}>{r.summary}</Text>
          </View>
          <View style={styles.heroRight}>
            <Text style={styles.eyebrow}>Pillars</Text>
            <View style={{ marginTop: 6 }}>
              {r.scoreCard.map((s) => (
                <ScoreLine key={s.label} label={s.label} value={s.score} />
              ))}
            </View>
          </View>
        </View>

        {r.issues.length > 0 && (
          <View>
            <SectionEyebrow>02 / Issues Found</SectionEyebrow>
            {[...r.issues]
              .sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority))
              .map((issue, i) => (
                <IssueRow key={i} issue={issue} />
              ))}
          </View>
        )}

        {r.schemaSuggestions.length > 0 && (
          <View>
            <SectionEyebrow>03 / Schema Suggestions</SectionEyebrow>
            {r.schemaSuggestions.map((snippet, i) => (
              <View key={i} style={styles.codeBlock} wrap>
                <Text>{snippet}</Text>
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}
