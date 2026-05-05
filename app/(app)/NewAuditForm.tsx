"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import UpgradeDialog, { type PlanCard } from "./UpgradeDialog";

export type SkillId = "audit" | "page" | "architecture" | "programmatic" | "rewrite";

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

  // 402 = Payment Required = our quota gate fired. Open the upgrade popup
  // instead of showing the inline error pill.
  async function handleResponse(res: Response): Promise<{ ok: boolean; data: { error?: string; id?: string } }> {
    const data = (await res.json().catch(() => ({}))) as { error?: string; id?: string };
    if (res.status === 402 && plans && plans.length > 0) {
      setQuotaMessage(data.error ?? "You've hit your monthly limit.");
      setQuotaOpen(true);
      return { ok: false, data };
    }
    return { ok: res.ok, data };
  }

  async function submit() {
    setError(null);
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
      const res = await fetch(`/api/seo/${skill}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const { ok, data } = await handleResponse(res);
      if (!ok) {
        if (res.status !== 402) throw new Error(data.error ?? "Request failed");
        return;
      }
      router.push(`/audits/${data.id}`);
      router.refresh();
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

      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="inline-block h-1 w-1 animate-pulse bg-accent" />
          <span>{LOADING_COPY[skill]}</span>
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
