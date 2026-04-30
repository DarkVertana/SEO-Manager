"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { checkPassword, isValidEmail, PASSWORD_RULES } from "@/lib/auth/validation";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const passwordCheck = useMemo(() => checkPassword(password), [password]);
  const passwordTouched = password.length > 0;

  async function submit() {
    setError(null);

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!passwordCheck.ok) {
      setError(passwordCheck.message);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "We couldn't create your account. Please try again.");
        return;
      }
      router.push("/");
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
        <span className="swiss-eyebrow text-muted">— 02 / Create Account</span>
        <h2 className="text-4xl font-medium tracking-tight">Open your studio.</h2>
        <p className="text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="underline underline-offset-4 hover:text-foreground">
            Sign in →
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
        <Field label="Name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="swiss-input"
            placeholder="Studio Müller"
            autoComplete="name"
          />
        </Field>
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
            onFocus={() => setShowRules(true)}
            className="swiss-input"
            placeholder={`At least ${PASSWORD_RULES.minLength} characters`}
            autoComplete="new-password"
          />
          {(showRules || passwordTouched) && (
            <ul className="mt-3 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
              <Rule ok={passwordCheck.checks.length} label={`${PASSWORD_RULES.minLength}+ characters`} touched={passwordTouched} />
              <Rule ok={passwordCheck.checks.uppercase} label="Uppercase letter" touched={passwordTouched} />
              <Rule ok={passwordCheck.checks.lowercase} label="Lowercase letter" touched={passwordTouched} />
              <Rule ok={passwordCheck.checks.number} label="Number" touched={passwordTouched} />
              <Rule ok={passwordCheck.checks.symbol} label="Symbol (!@#$ …)" touched={passwordTouched} />
            </ul>
          )}
        </Field>
        {error && (
          <div className="border border-accent px-4 py-3 text-sm leading-relaxed text-accent">{error}</div>
        )}
        <button type="submit" disabled={loading} className="swiss-btn">
          {loading ? "Creating account…" : "Create account →"}
        </button>
      </form>

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

function Rule({ ok, label, touched }: { ok: boolean; label: string; touched: boolean }) {
  const tone = !touched ? "text-muted" : ok ? "text-emerald-700 dark:text-emerald-400" : "text-accent";
  const glyph = !touched ? "·" : ok ? "✓" : "✗";
  return (
    <li className={`flex items-center gap-2 ${tone}`}>
      <span className="inline-block w-3 text-center">{glyph}</span>
      <span>{label}</span>
    </li>
  );
}
