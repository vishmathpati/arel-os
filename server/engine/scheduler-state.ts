/**
 * Scheduler state store — persisted as system/recipes/schedule.md (YAML frontmatter).
 * Each key is a recipe name; the value tracks the scheduler's next-due time, last-fired
 * time, and last status. Uses the vault I/O layer (atomic writes) so the file is
 * consistent even across concurrent ticks.
 *
 * On server start after sleep/shutdown, a next_due in the past triggers an immediate
 * catch-up run; the scheduler then advances to the next future slot.
 */

import { recipesSchedulePath } from "../../src/shared/lib/vault/paths.ts";
import { VaultNotFoundError, readVaultFile, writeVaultFile } from "../io.ts";

export interface SchedulerEntry {
  /** ISO timestamp of the next scheduled fire time (null = not yet seeded). */
  next_due: string | null;
  /** ISO timestamp of the last time this recipe was fired by the scheduler. */
  last_fired: string | null;
  /** Status of the last scheduled run. */
  last_status: "ok" | "failed" | null;
}

export type SchedulerState = Record<string, SchedulerEntry>;

/** Frontmatter keys stamped by the vault writer — not recipe entries. */
const RESERVED_KEYS = new Set(["created", "updated"]);

function coerceEntry(raw: unknown): SchedulerEntry {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { next_due: null, last_fired: null, last_status: null };
  }
  const r = raw as Record<string, unknown>;
  return {
    next_due: typeof r.next_due === "string" ? r.next_due : null,
    last_fired: typeof r.last_fired === "string" ? r.last_fired : null,
    last_status: r.last_status === "ok" || r.last_status === "failed" ? r.last_status : null,
  };
}

/** Read the scheduler state from the vault. Returns {} when the file is absent. */
export async function readSchedulerState(): Promise<SchedulerState> {
  try {
    const doc = await readVaultFile(recipesSchedulePath());
    const fm = doc.frontmatter as unknown as Record<string, unknown>;
    const state: SchedulerState = {};
    for (const [name, val] of Object.entries(fm)) {
      // Skip the writer's `created`/`updated` timestamp stamps and any scalar —
      // only object-valued keys are recipe entries.
      if (RESERVED_KEYS.has(name)) continue;
      if (!val || typeof val !== "object" || Array.isArray(val)) continue;
      state[name] = coerceEntry(val);
    }
    return state;
  } catch (err) {
    if (err instanceof VaultNotFoundError) return {};
    throw err;
  }
}

/**
 * Merge per-recipe updates into the current scheduler state and persist atomically.
 * Only the provided keys are changed; others are left intact.
 */
export async function mergeSchedulerState(updates: Record<string, SchedulerEntry>): Promise<void> {
  const current = await readSchedulerState();
  const merged: SchedulerState = { ...current, ...updates };
  const body = "<!-- Engine scheduler state — managed automatically; do not hand-edit. -->";
  await writeVaultFile(recipesSchedulePath(), merged as unknown as Record<string, unknown>, body);
}
