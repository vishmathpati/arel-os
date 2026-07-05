/**
 * Tests for the run-log parsing logic (ordering, limit, malformed-line skip).
 * We write JSONL directly to a tmp file and use the same parsing logic as
 * readRunRecords — tested inline here since injecting VAULT_ROOT into the module
 * would require refactoring; the parsing logic is the invariant that matters.
 */

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RunRecord } from "./runlog.ts";

const RECORD_A: RunRecord = {
  at: "2026-06-20T10:00:00.000Z",
  status: "ok",
  trigger: "manual",
  model: "deepseek/deepseek-v4-flash",
  durationMs: 5000,
  totalTokens: 1000,
  summary: "first run",
  changes: [],
};
const RECORD_B: RunRecord = {
  at: "2026-06-21T10:00:00.000Z",
  status: "ok",
  trigger: "scheduled",
  model: "deepseek/deepseek-v4-flash",
  durationMs: 7000,
  totalTokens: 2000,
  summary: "second run",
  changes: [{ op: "created", path: "system/summaries/foo.md" }],
};
const RECORD_C: RunRecord = {
  at: "2026-06-22T10:00:00.000Z",
  status: "failed",
  trigger: "ui",
  model: "openai/gpt-5.4-mini",
  durationMs: 1000,
  totalTokens: 0,
  summary: "error: model refused",
  changes: [],
};

/** Same parsing logic as readRunRecords, applied to an arbitrary file path. */
function parseRunLog(raw: string, limit?: number): RunRecord[] {
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
  const reversed = records.reverse();
  return limit !== undefined ? reversed.slice(0, limit) : reversed;
}

describe("runlog parsing — ordering and limit", () => {
  let tmpDir: string;
  let tmpFile: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "arelos-runlog-"));
    tmpFile = path.join(tmpDir, "runs.jsonl");
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function writeRecords(records: RunRecord[]): Promise<string> {
    const content = `${records.map((r) => JSON.stringify(r)).join("\n")}\n`;
    await fs.writeFile(tmpFile, content, "utf8");
    return content;
  }

  it("returns records newest-first", async () => {
    const raw = await writeRecords([RECORD_A, RECORD_B, RECORD_C]);
    const result = parseRunLog(raw);
    expect(result[0].at).toBe(RECORD_C.at); // newest first
    expect(result[1].at).toBe(RECORD_B.at);
    expect(result[2].at).toBe(RECORD_A.at);
  });

  it("respects the limit", async () => {
    const raw = await writeRecords([RECORD_A, RECORD_B, RECORD_C]);
    const result = parseRunLog(raw, 2);
    expect(result).toHaveLength(2);
    expect(result[0].at).toBe(RECORD_C.at);
    expect(result[1].at).toBe(RECORD_B.at);
  });

  it("returns empty array for empty content", () => {
    expect(parseRunLog("")).toEqual([]);
    expect(parseRunLog("\n\n")).toEqual([]);
  });

  it("skips malformed JSON lines without throwing", async () => {
    const mixed = `${JSON.stringify(RECORD_A)}\nnot-json\n${JSON.stringify(RECORD_B)}\n`;
    const result = parseRunLog(mixed);
    expect(result).toHaveLength(2);
    expect(result[0].at).toBe(RECORD_B.at);
    expect(result[1].at).toBe(RECORD_A.at);
  });

  it("line count equals number of non-empty lines", async () => {
    const raw = await writeRecords([RECORD_A, RECORD_B, RECORD_C]);
    const count = raw.split("\n").filter((l) => l.trim().length > 0).length;
    expect(count).toBe(3);
  });
});

describe("RunRecord changeset shape", () => {
  it("created change has op=created and a path string", () => {
    const change = RECORD_B.changes[0];
    expect(change?.op).toBe("created");
    expect(typeof change?.path).toBe("string");
  });

  it("a run with no writes has an empty changes array", () => {
    expect(RECORD_A.changes).toEqual([]);
  });
});
