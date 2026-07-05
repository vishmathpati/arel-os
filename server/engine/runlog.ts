/**
 * Structured run log — one JSON line per run in system/recipes/<name>/runs.jsonl.
 * Each record carries timing, status, and the changeset (which vault files the run
 * created or updated), so the UI can show full history + "what did this run change?"
 *
 * The human-readable log.md is kept as-is (debug/legibility); runs.jsonl is the
 * structured source the UI reads.
 */

import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import { recipeRunsPath } from "../../src/shared/lib/vault/paths.ts";
import { resolveVaultPath } from "../io.ts";
import type { VaultChange } from "./types.ts";

/** One structured record written per run — the history source of truth. */
export interface RunRecord {
  /** ISO timestamp of when the run finished. */
  at: string;
  status: "ok" | "failed";
  trigger: string;
  model: string;
  durationMs: number;
  totalTokens: number;
  /** Input tokens served from cache (0 if none). Lets us see if caching is working. */
  cachedTokens?: number;
  /** Short result summary (ok) or error message (failed). */
  summary: string;
  /** Vault files written during the run (empty when the run made no writes). */
  changes: VaultChange[];
}

/** Append one run record to system/recipes/<name>/runs.jsonl (creates file if absent). */
export async function appendRunRecord(name: string, record: RunRecord): Promise<void> {
  const abs = resolveVaultPath(recipeRunsPath(name));
  await fs.mkdir(dirname(abs), { recursive: true });
  await fs.appendFile(abs, `${JSON.stringify(record)}\n`, "utf8");
}

/**
 * Read the run records for a recipe, newest-first. Returns an empty array when
 * the file is absent (recipe has never run). Skips malformed lines silently.
 */
export async function readRunRecords(name: string, limit = 50): Promise<RunRecord[]> {
  const abs = resolveVaultPath(recipeRunsPath(name));
  let raw: string;
  try {
    raw = await fs.readFile(abs, "utf8");
  } catch {
    return [];
  }
  const records: RunRecord[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      records.push(JSON.parse(trimmed) as RunRecord);
    } catch {
      // skip malformed lines
    }
  }
  return records.reverse().slice(0, limit);
}

/** Count run records without fully parsing them (for the run-count badge). */
export async function countRunRecords(name: string): Promise<number> {
  const abs = resolveVaultPath(recipeRunsPath(name));
  try {
    const raw = await fs.readFile(abs, "utf8");
    return raw.split("\n").filter((l) => l.trim().length > 0).length;
  } catch {
    return 0;
  }
}
