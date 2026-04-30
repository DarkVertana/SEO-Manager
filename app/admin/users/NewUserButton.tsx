"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

export type PlanOption = { slug: string; name: string };

export default function NewUserButton({ plans }: { plans: PlanOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [planSlug, setPlanSlug] = useState(plans[0]?.slug ?? "starter");

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, busy]);

  function close() {
    setOpen(false);
    setError(null);
  }

  function reset() {
    setEmail("");
    setName("");
    setPassword("");
    setRole("user");
    setPlanSlug(plans[0]?.slug ?? "starter");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, name, password, role, planSlug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-foreground px-4 py-2 text-xs text-background hover:opacity-85"
      >
        + New user
      </button>

      {mounted && open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Create user"
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          >
            <button
              type="button"
              aria-label="Close"
              tabIndex={-1}
              onClick={() => !busy && close()}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <form
              onSubmit={submit}
              className="relative flex w-full max-w-lg flex-col gap-4 border border-foreground bg-background p-6 shadow-2xl"
            >
              <div className="flex items-baseline justify-between border-b border-hairline pb-3">
                <span className="swiss-eyebrow text-muted">— New user</span>
                <button
                  type="button"
                  onClick={close}
                  disabled={busy}
                  className="swiss-eyebrow text-muted hover:text-foreground disabled:opacity-50"
                >
                  ✕ Close
                </button>
              </div>

              <Field label="Email *">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="border-0 border-b border-hairline bg-transparent py-2 text-base outline-none focus:border-foreground"
                />
              </Field>
              <Field label="Display name">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  placeholder="Optional"
                  className="border-0 border-b border-hairline bg-transparent py-2 text-base outline-none focus:border-foreground"
                />
              </Field>
              <Field label="Password *" hint="At least 8 characters">
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="border-0 border-b border-hairline bg-transparent py-2 text-base outline-none focus:border-foreground"
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Role">
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as "user" | "admin")}
                    className="border border-hairline bg-transparent px-2 py-1.5 text-sm outline-none focus:border-foreground"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </Field>
                <Field label="Plan">
                  <select
                    value={planSlug}
                    onChange={(e) => setPlanSlug(e.target.value)}
                    className="border border-hairline bg-transparent px-2 py-1.5 text-sm outline-none focus:border-foreground"
                  >
                    {plans.map((p) => (
                      <option key={p.slug} value={p.slug}>{p.name}</option>
                    ))}
                  </select>
                </Field>
              </div>

              {error && <div className="border border-accent px-3 py-2 text-xs text-accent">{error}</div>}

              <div className="flex flex-col-reverse gap-2 border-t border-hairline pt-4 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  onClick={close}
                  disabled={busy}
                  className="border border-hairline px-5 py-2.5 text-sm hover:border-foreground disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || !email || password.length < 8}
                  className="bg-foreground px-5 py-2.5 text-sm text-background hover:opacity-85 disabled:opacity-50"
                >
                  {busy ? "Creating…" : "Create user →"}
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="swiss-eyebrow text-muted">{label}</span>
      {children}
      {hint && <span className="text-[10px] text-muted">{hint}</span>}
    </label>
  );
}
