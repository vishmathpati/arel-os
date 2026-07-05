/**
 * `.env` writer for the onboarding AI-key gate (spec §5, §7 PR6). Upserts a line
 * in the project root `.env` (NOT the vault) — the file `server/engine/engine.ts`
 * documents as the source of `AI_GATEWAY_API_KEY` / `ARELOS_ENGINE_MODEL` /
 * `ARELOS_ENGINE_FALLBACK` (Bun loads `.env` automatically).
 *
 * Security posture (spec §5, acceptance-blocking):
 *   - Allowlisted keys only — `ALLOWED_ENV_KEYS`. Anything else is refused before
 *     any file I/O happens.
 *   - Fixed path — always `<installDir>/.env`, derived server-side from
 *     `loadConfig().installDir`. The key/value the caller sends can NEVER steer
 *     the path (no path taken from the request at all).
 *   - No echo — the write path returns only the list of key NAMES that were set,
 *     never values. Callers (server/index.ts) must not put the value in the
 *     response body.
 *   - Preserves every other line in the file verbatim (comments, unrelated keys,
 *     blank lines) — only the matching `KEY=` line is replaced/appended.
 */

import { existsSync, readFileSync } from "node:fs";
import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import { loadConfig } from "./config.ts";

/** The only env vars this endpoint is allowed to write (spec §5). */
export const ALLOWED_ENV_KEYS = [
  "AI_GATEWAY_API_KEY",
  "ARELOS_ENGINE_MODEL",
  "ARELOS_ENGINE_FALLBACK",
] as const;

export type AllowedEnvKey = (typeof ALLOWED_ENV_KEYS)[number];

export function isAllowedEnvKey(key: string): key is AllowedEnvKey {
  return (ALLOWED_ENV_KEYS as readonly string[]).includes(key);
}

/** Thrown when a caller asks to write a key outside the allowlist. */
export class DisallowedEnvKeyError extends Error {
  constructor(key: string) {
    super(`'${key}' is not an allowed env key`);
    this.name = "DisallowedEnvKeyError";
  }
}

/** Absolute path to the `.env` file — always the install root, never request-derived. */
export function envFilePath(): string {
  return `${loadConfig().installDir}/.env`;
}

/** A minimal `.env` line parser: `KEY=value`, tolerant of quotes; skips comments/blank lines. */
function upsertLine(contents: string, key: string, value: string): string {
  const lines = contents.length > 0 ? contents.split("\n") : [];
  const escaped = value.replace(/\r?\n/g, "\\n");
  const needsQuotes = /[\s#"']/.test(escaped);
  const serialized = needsQuotes ? `"${escaped.replace(/"/g, '\\"')}"` : escaped;
  const newLine = `${key}=${serialized}`;

  const pattern = new RegExp(`^${key}=`);
  let replaced = false;
  const next = lines.map((line) => {
    if (pattern.test(line)) {
      replaced = true;
      return newLine;
    }
    return line;
  });

  if (!replaced) {
    // Drop a single trailing empty line (from a final newline) before appending,
    // then always end with exactly one trailing newline.
    if (next.length > 0 && next[next.length - 1] === "") next.pop();
    next.push(newLine);
  }

  return `${next.join("\n")}\n`;
}

/**
 * Upsert one or more allowlisted key/value pairs into `.env` at the install
 * root. Rejects (throws `DisallowedEnvKeyError`) before touching disk if ANY
 * key is outside the allowlist — partial writes never happen. Returns only the
 * key names written (never values) so callers can build a no-echo response.
 */
export async function writeEnvKeys(
  entries: Record<string, string>,
): Promise<{ keysSet: string[] }> {
  const keys = Object.keys(entries);
  for (const key of keys) {
    if (!isAllowedEnvKey(key)) throw new DisallowedEnvKeyError(key);
  }

  const path = envFilePath();
  let contents = "";
  if (existsSync(path)) {
    contents = readFileSync(path, "utf8");
  } else {
    await fs.mkdir(dirname(path), { recursive: true });
  }

  for (const key of keys) {
    contents = upsertLine(contents, key, entries[key] ?? "");
  }

  // Atomic write: temp sibling → rename, matching io.ts's discipline.
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, contents, "utf8");
  await fs.rename(tmp, path);

  // Make the freshly written values available to this running process immediately
  // (so a validation call right after saving sees the new key without a restart).
  for (const key of keys) {
    process.env[key] = entries[key];
  }

  return { keysSet: keys };
}
