/**
 * The structured-output schema for project-sync (D65). This is the zod mirror of
 * the *authored* subset of `ProjectSnapshot` — the prose fields the model writes
 * from a project's protocol markdown. It is the WRITE contract handed to
 * `generateObject`, so the synthesis is schema-valid by construction (no more
 * hand-authored JSON dropping a brace).
 *
 * Deliberately EXCLUDED from this schema, because the model must never author or
 * re-type them: `meta` (slug + server-stamped syncedAt + repoPresent), `manifest`
 * and `files` (verbatim from project-read), and `designFeel.tokens` (verbatim from
 * design-tokens). The Engine merges those in around the authored object — see
 * `assembleSnapshot`.
 */

import { z } from "zod";
import {
  type ProjectSnapshot,
  normalizeSnapshot,
} from "../../src/shared/lib/project-dashboard/snapshot.ts";
import type {
  ManifestEntry,
  SnapshotFile,
} from "../../src/shared/lib/project-dashboard/snapshot.ts";
import type { DesignTokens } from "../../src/shared/lib/project-dashboard/tokens.ts";

const state = z
  .enum(["healthy", "watch", "blocked", "unknown"])
  .describe("honest health roll-up of the project");

const titledItem = z.object({
  title: z.string().describe("the item, one short line"),
  detail: z.string().nullable().describe("optional second line; null if none"),
});

/** The prose fields the model authors. Everything else is code-assembled. */
export const AuthoredSnapshotSchema = z.object({
  overview: z.object({
    headline: z.string().describe("one sentence: where this project stands right now"),
    state,
    current: z.string().describe("what is actively happening now, one line"),
    recent: z.array(titledItem).describe("recent activity (WORKLOG/CHANGELOG); [] if none"),
    next: z.array(titledItem).describe("what is up next; [] if none"),
    blocked: z.array(titledItem).describe("anything blocked; [] if none"),
  }),
  whatChanged: z
    .array(
      z.object({
        version: z.string().nullable().describe("version tag, e.g. v1.26; null if none"),
        date: z.string().nullable().describe("date string; null if none"),
        items: z.array(z.string()).describe("what changed in this entry"),
      }),
    )
    .describe("from CHANGELOG; lead with what changed since the prior snapshot"),
  roadmap: z
    .array(
      z.object({
        phase: z.string().describe("phase/chapter name"),
        status: z.enum(["done", "active", "next", "later"]),
        detail: z.string().nullable().describe("one-line detail; null if none"),
        items: z.array(z.string()).describe("the work in this phase"),
      }),
    )
    .describe("from ROADMAP, as phases marked done/active/next/later"),
  decisions: z
    .array(
      z.object({
        title: z.string().describe("what was decided, short"),
        decided: z.string().nullable(),
        rejected: z.string().nullable().describe("the rejected alternative; null if none"),
        why: z.string().nullable(),
      }),
    )
    .describe("from BRIEF; favor decisions that changed direction"),
  structure: z.object({
    layers: z.array(z.string()).describe("top-to-bottom architecture layers"),
    folders: z.array(z.object({ name: z.string(), role: z.string() })),
    dataFlow: z.array(
      z.object({
        from: z.string(),
        to: z.string(),
        label: z.string().nullable().describe("edge label; null if none"),
      }),
    ),
  }),
  designFeel: z.object({
    stack: z.array(z.object({ name: z.string(), role: z.string() })),
    brand: z.object({
      name: z.string().nullable(),
      tagline: z.string().nullable(),
      audience: z.string().nullable(),
      problem: z.string().nullable(),
    }),
    direction: z.string().describe("the design direction in plain prose (from DESIGN.md)"),
    principles: z.array(z.string()),
  }),
});

export type AuthoredSnapshot = z.infer<typeof AuthoredSnapshotSchema>;

/** The non-authored inputs the Engine merges around the model's prose. */
export interface SnapshotAssembly {
  project: string;
  /** ISO timestamp, stamped server-side (the model has no clock). */
  syncedAt: string;
  repoPresent: boolean;
  /** Verbatim from project-read. */
  manifest: ManifestEntry[];
  /** Verbatim from project-read. */
  files: SnapshotFile[];
  /** Verbatim from design-tokens (or null if the project has none). */
  tokens: DesignTokens | null;
}

/**
 * Combine the model's authored prose with the verbatim/server-set parts into a
 * full ProjectSnapshot, then run it through the defensive `normalizeSnapshot`
 * (the same coercion the UI applies) so the written file is always well-formed.
 * `meta.state` is taken from the authored `overview.state` — one source of truth.
 */
export function assembleSnapshot(
  authored: AuthoredSnapshot,
  parts: SnapshotAssembly,
): ProjectSnapshot {
  return normalizeSnapshot({
    meta: {
      project: parts.project,
      syncedAt: parts.syncedAt,
      state: authored.overview.state,
      repoPresent: parts.repoPresent,
    },
    manifest: parts.manifest,
    overview: authored.overview,
    whatChanged: authored.whatChanged,
    roadmap: authored.roadmap,
    decisions: authored.decisions,
    structure: authored.structure,
    designFeel: { ...authored.designFeel, tokens: parts.tokens },
    files: parts.files,
  });
}
