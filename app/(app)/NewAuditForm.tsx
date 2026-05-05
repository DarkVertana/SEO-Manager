"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import UpgradeDialog, { type PlanCard } from "./UpgradeDialog";

export type SkillId = "audit" | "page" | "architecture" | "programmatic" | "rewrite";

type StepStatus = "pending" | "queued" | "running" | "done" | "failed";
type StepRow = { index: number; label: string; status: StepStatus; error?: string; durationMs?: number };

// Shape of an event line emitted by /api/seo/audit (NDJSON stream). Mirrors
// AuditEvent in lib/seo/audit.ts plus the wrapper events the route adds.
type AuditStreamEvent =
  | { type: "start"; total: number; steps: { index: number; label: string }[] }
  | { type: "step"; index: number; label: string; status: "queued" }
  | { type: "step"; index: number; label: string; status: "running" }
  | { type: "step"; index: number; label: string; status: "done"; durationMs: number }
  | { type: "step"; index: number; label: string; status: "failed"; error: string; durationMs: number }
  | { type: "complete"; id: string }
  | { type: "error"; error: string };

const PLAYBOOKS = [
  "Templates",
  "Curation",
  "Conversions",
  "Comparisons",
  "Examples",
  "Locations",
  "Personas",
  "Integrations",
  "Glossary",
  "Translations",
  "Directory",
  "Profiles",
] as const;

const LOADING_COPY: Record<SkillId, string> = {
  audit: "Fetching page · robots.txt · sitemap · 7 agents in parallel…",
  page: "Fetching page · running 5-pillar deep analysis…",
  architecture: "Inferring hierarchy · auditing nav · URL hygiene · internal linking…",
  programmatic: "Picking playbook · designing template · estimating thin-content risk…",
  rewrite: "Capturing HTML & CSS · inlining stylesheets…",
};

export default function NewAuditForm({
  defaultSkill = "audit",
  currentPlanSlug,
  plans,
}: {
  defaultSkill?: SkillId;
  currentPlanSlug?: string;
  plans?: PlanCard[];
}) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [skill, setSkill] = useState<SkillId>(defaultSkill);
  const [playbook, setPlaybook] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaOpen, setQuotaOpen] = useState(false);
  const [quotaMessage, setQuotaMessage] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepRow[]>([]);

  // 402 = Payment Required = our quota gate fired. Open the upgrade popup
  // instead of showing the inline error pill. For other failures, surface the
  // server's error message — falling back to the raw response text + status so
  // we never show an opaque "Request failed" when the function times out and
  // returns HTML/empty body.
  async function handleResponse(res: Response): Promise<{ ok: boolean; data: { error?: string; id?: string } }> {
    const raw = await res.text();
    let data: { error?: string; id?: string } = {};
    try { data = raw ? (JSON.parse(raw) as { error?: string; id?: string }) : {}; } catch { /* non-JSON body */ }
    if (res.status === 402 && plans && plans.length > 0) {
      setQuotaMessage(data.error ?? "You've hit your monthly limit.");
      setQuotaOpen(true);
      return { ok: false, data };
    }
    if (!res.ok && !data.error) {
      const snippet = raw.slice(0, 240).trim();
      if (res.status === 504) data.error = "The audit took too long and timed out. Please try again — partial reruns are usually faster.";
      else if (res.status >= 500) data.error = `Server error (${res.status})${snippet ? `: ${snippet}` : ""}`;
      else data.error = `Request failed (${res.status})${snippet ? `: ${snippet}` : ""}`;
    }
    return { ok: res.ok, data };
  }

  // /api/seo/{audit,page,architecture,programmatic} all stream NDJSON so the
  // form can paint the same Swiss step list regardless of which command the
  // user chose. Rewrite still returns a single JSON object since it kicks off
  // a non-LLM Playwright capture flow with no per-step granularity.
  async function runStream(endpoint: string, payload: Record<string, unknown>) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      // Quota or validation error — body is plain JSON, not a stream.
      const { ok, data } = await handleResponse(res);
      if (!ok && res.status !== 402) throw new Error(data.error ?? "Request failed");
      return;
    }
    if (!res.body) throw new Error("Audit stream unavailable.");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let savedId: string | null = null;
    let streamError: string | null = null;

    while (true) {
      const { value, done } = await reader.read();
      if (value) buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        let event: AuditStreamEvent;
        try { event = JSON.parse(line) as AuditStreamEvent; } catch { continue; }
        if (event.type === "start") {
          setSteps(event.steps.map((s) => ({ ...s, status: "pending" })));
        } else if (event.type === "step") {
          setSteps((prev) =>
            prev.map((row) =>
              row.index === event.index
                ? {
                    ...row,
                    status: event.status,
                    error: event.status === "failed" ? event.error : undefined,
                    durationMs:
                      event.status === "done" || event.status === "failed"
                        ? event.durationMs
                        : row.durationMs,
                  }
                : row,
            ),
          );
        } else if (event.type === "complete") {
          savedId = event.id;
        } else if (event.type === "error") {
          streamError = event.error;
        }
      }
      if (done) break;
    }

    if (streamError) throw new Error(streamError);
    if (!savedId) throw new Error("Audit finished without saving a record.");
    router.push(`/audits/${savedId}`);
    router.refresh();
  }

  async function submit() {
    setError(null);
    setSteps([]);
    setLoading(true);
    try {
      if (skill === "rewrite") {
        const res = await fetch(`/api/seo/rewrite/capture`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const { ok, data } = await handleResponse(res);
        if (!ok) {
          if (res.status !== 402) throw new Error(data.error ?? "Request failed");
          return; // quota dialog handled it
        }
        router.push(`/rewrite-content/${data.id}`);
        router.refresh();
        return;
      }
      const payload: { url: string; playbook?: string } = { url };
      if (skill === "programmatic" && playbook) payload.playbook = playbook;
      await runStream(`/api/seo/${skill}`, payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-4"
    >
      <div className="border-b border-hairline">
        <div
          className="-mb-px flex gap-x-4 overflow-x-auto whitespace-nowrap pb-3 sm:gap-x-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="SEO skill"
        >
          {(["audit", "page", "architecture", "programmatic"] as const).map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={skill === c}
              onClick={() => setSkill(c)}
              className={`shrink-0 text-sm font-medium tracking-wide transition-colors ${
                skill === c ? "text-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              <span className={skill === c ? "border-b-2 border-foreground pb-3" : ""}>
                <span className="sm:hidden">{c}</span>
                <span className="hidden sm:inline">/seo {c}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="swiss-eyebrow text-muted">
          URL <span className="text-accent">*</span>
        </span>
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          className="border-0 border-b border-hairline bg-transparent py-2.5 text-base outline-none transition-colors focus:border-foreground"
        />
      </label>

      {skill === "programmatic" && (
        <label className="flex flex-col gap-1">
          <span className="swiss-eyebrow text-muted">
            Playbook hint <span className="text-muted">(optional)</span>
          </span>
          <select
            value={playbook}
            onChange={(e) => setPlaybook(e.target.value)}
            className="border-0 border-b border-hairline bg-transparent py-2.5 text-base outline-none transition-colors focus:border-foreground"
          >
            <option value="">Auto — let the agent choose</option>
            {PLAYBOOKS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      )}

      {error && <div className="border border-accent px-4 py-3 text-sm text-accent">{error}</div>}

      <button
        type="submit"
        disabled={loading || !url}
        className="w-full bg-foreground px-6 py-3 text-sm font-medium tracking-wide text-background transition-opacity hover:opacity-85 disabled:opacity-50 sm:w-auto sm:self-start"
      >
        {loading ? `Running /seo ${skill}…` : `Run /seo ${skill} →`}
      </button>

      {loading && skill === "rewrite" && (
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="inline-block h-1 w-1 animate-pulse bg-accent" />
          <span>{LOADING_COPY[skill]}</span>
        </div>
      )}

      {skill !== "rewrite" && steps.length > 0 && (
        <div className="border-t border-hairline pt-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="swiss-eyebrow text-muted">— /seo {skill} pipeline</span>
            <span className="font-mono text-[10px] text-muted">
              {steps.filter((s) => s.status === "done").length}/{steps.length}
            </span>
          </div>
          <ol className="flex flex-col">
            {steps.map((s) => {
              const num = s.index.toString().padStart(2, "0");
              const isQueued = s.status === "queued";
              const isRunning = s.status === "running";
              const isDone = s.status === "done";
              const isFailed = s.status === "failed";
              const isActive = isQueued || isRunning;
              return (
                <li
                  key={s.index}
                  className="flex items-center gap-3 border-b border-hairline py-2 last:border-b-0"
                >
                  <span className="w-8 font-mono text-[10px] tracking-wider text-muted">{num}</span>
                  <span
                    className={`inline-block h-2 w-2 shrink-0 transition-colors ${
                      isFailed
                        ? "bg-accent"
                        : isDone
                          ? "bg-foreground"
                          : isRunning
                            ? "animate-pulse bg-foreground"
                            : isQueued
                              ? "bg-hairline"
                              : "border border-hairline"
                    }`}
                    aria-hidden
                  />
                  <span
                    className={`flex-1 text-sm transition-colors ${
                      isDone || isFailed || isActive ? "text-foreground" : "text-muted"
                    }`}
                  >
                    {s.label}
                    {isFailed && s.error && (
                      <span className="ml-2 text-xs text-accent">— {s.error}</span>
                    )}
                  </span>
                  <span className="font-mono text-[10px] text-muted">
                    {isQueued && "queued…"}
                    {isRunning && "running…"}
                    {isDone && s.durationMs != null && `${(s.durationMs / 1000).toFixed(1)}s`}
                    {isFailed && "failed"}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {plans && plans.length > 0 && (
        <UpgradeDialog
          open={quotaOpen}
          onClose={() => setQuotaOpen(false)}
          currentSlug={currentPlanSlug ?? "starter"}
          plans={plans}
          eyebrow="— Limit reached"
          headline="You've hit your monthly limit."
          blurb={quotaMessage ?? undefined}
        />
      )}
    </form>
  );
}
