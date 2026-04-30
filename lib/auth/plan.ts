// Plan-related helpers. Plan rows now live in the DB (Plan table) — fetch via
// `db.plan.findUnique({ where: { slug } })`. The constants below are types and
// pure UI helpers only.

export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled";

// Visual accent for plan badges. With user-created plans there's no fixed
// tier ordering, so we derive accent from price: free → hairline, mid → red,
// expensive (top of catalog) → foreground/inverted.
export function planAccentByPrice(monthlyPriceCents: number, isTopTier = false): string {
  if (isTopTier) return "bg-foreground text-background";
  if (monthlyPriceCents <= 0) return "border border-hairline text-foreground";
  return "bg-accent text-white";
}

export function statusAccent(status: SubscriptionStatus): string {
  if (status === "active") return "text-emerald-700 dark:text-emerald-400";
  if (status === "trialing") return "text-amber-700 dark:text-amber-500";
  if (status === "past_due") return "text-amber-700 dark:text-amber-500";
  return "text-accent"; // canceled
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatPrice(cents: number, currency = "USD"): string {
  if (cents === 0) return "Free";
  const dollars = cents / 100;
  if (currency === "USD") return `$${dollars % 1 === 0 ? dollars.toFixed(0) : dollars.toFixed(2)}`;
  return `${dollars} ${currency}`;
}

export function pct(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((used / limit) * 100)));
}

// BigInt → number for storageBytes display. Safe up to 2^53 bytes (~9 PB).
export function bytesAsNumber(value: bigint | number): number {
  return typeof value === "bigint" ? Number(value) : value;
}

// Slug validation: lowercase alphanum + hyphens, 2-32 chars. Used by the
// plan-create form and the API route to reject malformed slugs early.
export const PLAN_SLUG_REGEX = /^[a-z][a-z0-9-]{1,31}$/;
