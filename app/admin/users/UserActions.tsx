"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

export type UserRow = {
  id: string;
  email: string;
  name: string | null;
};

// Per-row action cluster: Edit and Delete. The current admin's row gets the
// Delete button hidden via `isSelf` so the back-end self-protect is also
// reflected in the UI.
export default function UserActions({
  user,
  isSelf,
}: {
  user: UserRow;
  isSelf: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-muted hover:text-foreground"
          title="Edit user"
          aria-label={`Edit ${user.email}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" aria-hidden>
            <path d="M4 20h4l11-11-4-4L4 16v4zM14 5l5 5" />
          </svg>
        </button>
        {!isSelf && (
          <button
            type="button"
            onClick={() => setDeleting(true)}
            className="text-muted hover:text-accent"
            title="Delete user"
            aria-label={`Delete ${user.email}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" aria-hidden>
              <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
            </svg>
          </button>
        )}
        {isSelf && (
          <span className="text-[10px] text-muted">YOU</span>
        )}
      </div>

      <EditUserDialog user={user} open={editing} onClose={() => setEditing(false)} />
      <DeleteUserDialog user={user} open={deleting} onClose={() => setDeleting(false)} />
    </>
  );
}

function useDialogChrome(open: boolean, busy: boolean, onClose: () => void) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, busy, onClose]);
  return mounted;
}

function EditUserDialog({
  user,
  open,
  onClose,
}: {
  user: UserRow;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(user.name ?? "");
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(user.name ?? "");
      setEmail(user.email);
      setPassword("");
      setError(null);
    }
  }, [open, user]);

  const mounted = useDialogChrome(open, busy, onClose);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body: { name?: string; email?: string; password?: string } = {};
      if (name.trim() !== (user.name ?? "")) body.name = name.trim();
      if (email.trim().toLowerCase() !== user.email.toLowerCase()) body.email = email.trim();
      if (password.length > 0) body.password = password;
      if (Object.keys(body).length === 0) {
        setError("Nothing to update.");
        setBusy(false);
        return;
      }
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit user"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={() => !busy && onClose()}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <form
        onSubmit={submit}
        className="relative flex w-full max-w-md flex-col gap-4 border border-foreground bg-background p-6 shadow-2xl"
      >
        <div className="flex items-baseline justify-between border-b border-hairline pb-3">
          <span className="swiss-eyebrow text-muted">— Edit user</span>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="swiss-eyebrow text-muted hover:text-foreground disabled:opacity-50"
          >
            ✕ Close
          </button>
        </div>

        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
        <Field label="New password" hint="Leave blank to keep current">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className="border-0 border-b border-hairline bg-transparent py-2 text-base outline-none focus:border-foreground"
          />
        </Field>

        {error && <div className="border border-accent px-3 py-2 text-xs text-accent">{error}</div>}

        <div className="flex flex-col-reverse gap-2 border-t border-hairline pt-4 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="border border-hairline px-5 py-2.5 text-sm hover:border-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="bg-foreground px-5 py-2.5 text-sm text-background hover:opacity-85 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save changes →"}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function DeleteUserDialog({
  user,
  open,
  onClose,
}: {
  user: UserRow;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mounted = useDialogChrome(open, busy, onClose);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Delete user"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={() => !busy && onClose()}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <div className="relative flex w-full max-w-md flex-col gap-5 border border-foreground bg-background p-6 shadow-2xl">
        <div className="flex items-baseline justify-between border-b border-hairline pb-3">
          <span className="swiss-eyebrow text-muted">— Confirm</span>
          <span className="swiss-eyebrow text-muted">USER</span>
        </div>
        <div>
          <h2 className="text-2xl font-medium tracking-tight">Delete this user?</h2>
          <p className="mt-2 text-sm text-muted">
            All of this user's audits, rewrite captures, and subscription
            records will be permanently removed. This cannot be undone.
          </p>
          <div className="mt-3 border border-hairline bg-zinc-50/70 px-3 py-2 text-xs backdrop-blur-sm dark:bg-zinc-900/60">
            <div className="swiss-eyebrow text-muted">Account</div>
            <div className="mt-1 break-all font-mono">{user.email}</div>
          </div>
        </div>

        {error && <div className="border border-accent px-3 py-2 text-xs text-accent">{error}</div>}

        <div className="flex flex-col-reverse gap-2 border-t border-hairline pt-4 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="border border-hairline px-5 py-2.5 text-sm hover:border-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            autoFocus
            className="bg-accent px-5 py-2.5 text-sm text-white hover:opacity-85 disabled:opacity-50"
          >
            {busy ? "Deleting…" : "Delete →"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
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
