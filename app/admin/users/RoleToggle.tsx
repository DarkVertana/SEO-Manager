"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Role = "user" | "admin";

export default function RoleToggle({
  userId,
  email,
  role,
  isSelf,
}: {
  userId: string;
  email: string;
  role: Role;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setRole(next: Role) {
    if (next === role) return;
    if (isSelf) return;
    if (next === "user" && !confirm(`Demote ${email} to a regular user?`)) return;
    if (next === "admin" && !confirm(`Promote ${email} to admin?`)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="inline-flex items-stretch border border-hairline">
        {(["user", "admin"] as const).map((r) => {
          const active = r === role;
          return (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              disabled={loading || isSelf || active}
              aria-pressed={active}
              className={`px-2.5 py-1 text-[10px] uppercase tracking-widest transition-colors ${
                active
                  ? r === "admin"
                    ? "bg-accent text-white"
                    : "bg-foreground text-background"
                  : "text-muted hover:bg-hairline/40 hover:text-foreground"
              } disabled:cursor-not-allowed disabled:opacity-60`}
              title={isSelf ? "You cannot change your own role" : `Set role to ${r}`}
            >
              {r}
            </button>
          );
        })}
      </div>
      {isSelf && <span className="text-[10px] text-muted">You</span>}
      {error && <span className="text-[10px] text-accent">{error}</span>}
    </div>
  );
}
