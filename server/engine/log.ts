/**
 * Run logger — appends one debug-grade line to a recipe's log.md per run. The
 * line carries enough to debug a failure without re-running it: when, status,
 * what triggered it, which model, how long, tokens, and the result/error.
 * Format: `[YYYY-MM-DD HH:MM] status · trigger=… · model=… · <Xs> · <Ntok> · result-or-error`.
 */

import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import { recipeLogPath } from "../../src/shared/lib/vault/paths.ts";
import { resolveVaultPath } from "../io.ts";
import type { RunOutcome } from "./types.ts";

function stamp(d: Date): string {
  return d.toISOString().slice(0, 16).replace("T", " ");
}

function humanTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k tok` : `${n} tok`;
}

/** Append a run line to system/recipes/<name>/log.md (creates the file if missing). */
export async function appendRunLog(name: string, o: RunOutcome): Promise<void> {
  const status = o.status === "ok" ? "ok    " : "FAILED";
  const line =
    `[${stamp(new Date())}] ${status} · trigger=${o.trigger} · model=${o.model} · ` +
    `${(o.durationMs / 1000).toFixed(1)}s · ${humanTokens(o.totalTokens)} · ${o.summary}\n`;
  const abs = resolveVaultPath(recipeLogPath(name));
  await fs.mkdir(dirname(abs), { recursive: true });
  await fs.appendFile(abs, line, "utf8");
}
