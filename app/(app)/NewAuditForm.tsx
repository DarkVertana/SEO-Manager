"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import UpgradeDialog, { type PlanCard } from "./UpgradeDialog";
import AuditProgressModal, { type ProgressStep } from "./AuditProgressModal";

export type SkillId = "audit" | "page" | "architecture" | "programmatic" | "rewrite";

// Shape of an event line emitted by the streaming routes. Mirrors AuditEvent
// in lib/seo/audit.ts plus the wrapper events the route adds (init/complete/
// error all carry the pre-allocated record id, so the form can navigate even
// if the connection drops before "complete" arrives).
type AuditStreamEvent =
  | { type: "init"; id: string }
  | { type: "start"; total: number; steps: { index: number; label: string }[] }
  | { type: "step"; index: number; label: string; status: "queued" }
  | { type: "step"; index: number; label: string; status: "running" }
  | { type: "step"; index: number; label: string; status: "done"; durationMs: number }
  | { type: "step"; index: number; label: string; status: "failed"; error: string; durationMs: number }
  | { type: "complete"; id: string }
  | { type: "error"; error: string; id?: string };

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
  const [steps, setSteps] = useState<ProgressStep[]>([]);
  const [progressOpen, setProgressOpen] = useState(false);
  const [progressUrl, setProgressUrl] = useState("");
  const [progressSkill, setProgressSkill] = useState<SkillId>("audit");
  const [progressError, setProgressError] = useState<string | null>(null);

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

  // /api/seo/{audit,page,architecture,programmatic} all stream NDJSON. We
  // capture two ids from the stream:
  //   initId     — pre-allocated record id sent before any work starts.
  //                Lets us navigate even if the connection drops before the
  //                final "complete" event (Vercel sometimes buffers / kills
  //                the trailing chunk on long-running functions).
  //   completeId — sent after the report is saved. Same id; arrival means
  //                the report row in the DB is fully populated.
  // On stream end we navigate to whichever id we have.
  async function runStream(endpoint: string, payload: Record<string, unknown>) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const { ok, data } = await handleResponse(res);
      if (!ok && res.status !== 402) throw new Error(data.error ?? "Request failed");
      return;
    }
    if (!res.body) throw new Error("Audit stream unavailable.");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let initId: string | null = null;
    let streamError: string | null = null;

    // Hard-navigate as soon as we know the destination id. Using
    // window.location.assign bypasses Next.js client-side routing —
    // router.push silently no-ops in some Vercel edge cases when a stream
    // is still tied up. assign() always works and the destination page
    // (audit detail) handles the in-progress polling fallback if the
    // record is still being written.
    const goto = (id: string) => {
      try { reader.cancel().catch(() => {}); } catch { /* ignore */ }
      window.location.assign(`/audits/${id}`);
    };

    streamLoop: while (true) {
      const { value, done } = await reader.read();
      if (value) buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        let event: AuditStreamEvent;
        try { event = JSON.parse(line) as AuditStreamEvent; } catch { continue; }
        if (event.type === "init") {
          initId = event.id;
        } else if (event.type === "start") {
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
          // Don't wait for stream close — leave for the report page now.
          goto(event.id);
          return;
        } else if (event.type === "error") {
          streamError = event.error;
          if (event.id) initId = initId ?? event.id;
          break streamLoop;
        }
      }
      if (done) break;
    }

    if (streamError) {
      // We have an init id even on failure — the user can revisit it from
      // /history later. Surface the error in the modal and stay put.
      throw new Error(streamError);
    }
    if (!initId) throw new Error("Audit finished without saving a record.");
    // Stream closed without a complete event (Vercel buffer / timeout). The
    // record exists; the audit page will poll-refresh until db.update lands.
    goto(initId);
  }

  async function submit() {
    setError(null);
    setSteps([]);
    setProgressError(null);
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
          return;
        }
        router.push(`/rewrite-content/${data.id}`);
        router.refresh();
        return;
      }
      // Open the modal up front so the user sees something immediately, even
      // before the first event arrives from the stream.
      setProgressUrl(url);
      setProgressSkill(skill);
      setProgressOpen(true);
      const payload: { url: string; playbook?: string } = { url };
      if (skill === "programmatic" && playbook) payload.playbook = playbook;
      await runStream(`/api/seo/${skill}`, payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed";
      setError(message);
      setProgressError(message);
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

      <AuditProgressModal
        open={progressOpen}
        url={progressUrl}
        skill={progressSkill}
        steps={steps}
        error={progressError}
        onClose={() => setProgressOpen(false)}
      />

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
