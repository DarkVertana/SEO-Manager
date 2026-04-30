"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ProfileForm({ initialName }: { initialName: string }) {
  const router = useRouter();

  const [name, setName] = useState(initialName);
  const [nameLoading, setNameLoading] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setNameLoading(true);
    setNameMsg(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      setNameMsg({ kind: "ok", text: "Display name saved." });
      router.refresh();
    } catch (err) {
      setNameMsg({ kind: "err", text: err instanceof Error ? err.message : "Update failed" });
    } finally {
      setNameLoading(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwLoading(true);
    setPwMsg(null);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Password change failed");
      setCurrentPassword("");
      setNewPassword("");
      setPwMsg({ kind: "ok", text: "Password updated." });
    } catch (err) {
      setPwMsg({ kind: "err", text: err instanceof Error ? err.message : "Password change failed" });
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      {/* Display name */}
      <form onSubmit={saveName} className="flex flex-col gap-4 border border-hairline p-6">
        <span className="swiss-eyebrow text-muted">Display name</span>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Up to 80 characters. Leave blank to clear.</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="Your name"
            className="border-0 border-b border-hairline bg-transparent py-2.5 text-base outline-none transition-colors focus:border-foreground"
          />
        </label>
        {nameMsg && (
          <div
            className={`px-3 py-2 text-xs ${
              nameMsg.kind === "ok"
                ? "border border-emerald-700/40 text-emerald-700 dark:text-emerald-300"
                : "border border-accent text-accent"
            }`}
          >
            {nameMsg.text}
          </div>
        )}
        <button
          type="submit"
          disabled={nameLoading || name === initialName}
          className="w-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-40 sm:w-auto sm:self-start"
        >
          {nameLoading ? "Saving…" : "Save name →"}
        </button>
      </form>

      {/* Password */}
      <form onSubmit={changePassword} className="flex flex-col gap-4 border border-hairline p-6">
        <span className="swiss-eyebrow text-muted">Change password</span>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Current password</span>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="border-0 border-b border-hairline bg-transparent py-2.5 text-base outline-none transition-colors focus:border-foreground"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">New password (≥ 8 chars)</span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="border-0 border-b border-hairline bg-transparent py-2.5 text-base outline-none transition-colors focus:border-foreground"
          />
        </label>
        {pwMsg && (
          <div
            className={`px-3 py-2 text-xs ${
              pwMsg.kind === "ok"
                ? "border border-emerald-700/40 text-emerald-700 dark:text-emerald-300"
                : "border border-accent text-accent"
            }`}
          >
            {pwMsg.text}
          </div>
        )}
        <button
          type="submit"
          disabled={pwLoading || currentPassword.length === 0 || newPassword.length < 8}
          className="w-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-40 sm:w-auto sm:self-start"
        >
          {pwLoading ? "Updating…" : "Change password →"}
        </button>
      </form>
    </div>
  );
}
