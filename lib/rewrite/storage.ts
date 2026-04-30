import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db } from "@/lib/db";

// Captures do not expire. The `expiresAt` column is kept for schema compatibility
// and set far in the future on every capture; nothing in the app gates on it.
export const REWRITE_TTL_DAYS = 365 * 100;
const ROOT = join(tmpdir(), "seo-manager-rewrite");

export function pageDir(id: string): string {
  return join(ROOT, id);
}

export function pageFile(id: string): string {
  return join(pageDir(id), "page.html");
}

// Snapshot of the page as it was captured. Never overwritten after the initial
// write so the rewrite-summary download can reconstruct before/after diffs
// even after the workspace is refreshed (in-memory run log is lost on reload).
export function originalPageFile(id: string): string {
  return join(pageDir(id), "original.html");
}

export async function writePageHtml(id: string, html: string): Promise<{ size: number; path: string }> {
  const dir = pageDir(id);
  await mkdir(dir, { recursive: true });
  const file = pageFile(id);
  await writeFile(file, html, "utf8");
  return { size: Buffer.byteLength(html, "utf8"), path: file };
}

export async function writeOriginalIfMissing(id: string, html: string): Promise<void> {
  const dir = pageDir(id);
  await mkdir(dir, { recursive: true });
  const file = originalPageFile(id);
  if (existsSync(file)) return;
  await writeFile(file, html, "utf8");
}

export async function readPageHtml(id: string): Promise<string | null> {
  const file = pageFile(id);
  if (!existsSync(file)) return null;
  return readFile(file, "utf8");
}

export async function readOriginalHtml(id: string): Promise<string | null> {
  const file = originalPageFile(id);
  if (!existsSync(file)) return null;
  return readFile(file, "utf8");
}

export async function deletePageDir(id: string): Promise<void> {
  await rm(pageDir(id), { recursive: true, force: true });
}

// Captures never expire — kept as a no-op so existing call sites still compile.
export async function cleanupExpired(): Promise<{ deleted: number }> {
  return { deleted: 0 };
}
