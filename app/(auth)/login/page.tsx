"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(null);
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "We couldn't sign you in. Please try again.");
        return;
      }
      router.push(from);
      router.refresh();
    } catch {
      setError("Network problem — please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <span className="swiss-eyebrow text-muted">— 02 / Sign In</span>
        <h2 className="text-4xl font-medium tracking-tight">Welcome back.</h2>
        <p className="text-sm text-muted">
          New here?{" "}
          <Link href="/register" className="underline underline-offset-4 hover:text-foreground">
            Create an account →
          </Link>
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        noValidate
        className="flex flex-col gap-5"
      >
        <Field label="Email" required>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="swiss-input"
            placeholder="you@studio.com"
            autoComplete="email"
          />
        </Field>
        <Field label="Password" required>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="swiss-input"
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </Field>
        {error && (
          <div role="alert" className="border border-accent px-4 py-3 text-sm leading-relaxed text-accent">
            {error}
          </div>
        )}
        <button type="submit" disabled={loading} className="swiss-btn">
          {loading ? "Signing in…" : "Sign in →"}
        </button>
      </form>

      <p className="text-xs text-muted">
        By continuing you agree to keep your audits private to your account.
      </p>

      <style jsx>{`
        :global(.swiss-input) {
          width: 100%;
          background: transparent;
          border: 0;
          border-bottom: 1px solid var(--hairline);
          padding: 0.625rem 0;
          font-size: 0.9375rem;
          outline: none;
          transition: border-color 120ms ease;
        }
        :global(.swiss-input:focus) {
          border-color: var(--foreground);
        }
        :global(.swiss-btn) {
          background: var(--foreground);
          color: var(--background);
          border: 0;
          padding: 0.875rem 1.25rem;
          font-size: 0.875rem;
          font-weight: 500;
          letter-spacing: 0.02em;
          cursor: pointer;
          transition: opacity 120ms ease;
          text-align: left;
        }
        :global(.swiss-btn:hover) {
          opacity: 0.85;
        }
        :global(.swiss-btn:disabled) {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="swiss-eyebrow text-muted">
        {label}
        {required && <span className="text-accent"> *</span>}
      </span>
      {children}
    </label>
  );
}
