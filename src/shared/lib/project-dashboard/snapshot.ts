/**
 * The ProjectSnapshot — the single artifact the software-project dashboard reads.
 * The `project-sync` recipe (authored at the ecosystem tier) writes one of these
 * per project to `system/project-snapshots/<slug>.md` as a light-frontmatter doc
 * whose body is a single ```json block holding this object. The UI only ever reads
 * the snapshot; the AI runs only on cron / Run-now (D63/D64).
 *
 * This module is the UI's READ contract and the ecosystem SKILL.md's WRITE
 * contract — they must agree on this shape. Browser-safe (types + a defensive
 * parser; the AI can emit partial JSON, so `parseSnapshot` normalizes every field
 * to a safe default rather than trusting the model).
 */

import { type DesignTokens, emptyDesignTokens } from "./tokens";

/** Health roll-up shown as the Overview state pill. */
export type ProjectState = "healthy" | "watch" | "blocked" | "unknown";

/** A title + optional one-line detail — the recent/next/blocked item shape. */
export interface TitledItem {
  title: string;
  detail?: string;
}

export interface SnapshotMeta {
  /** Project slug (matches the snapshot filename + the project's vault slug). */
  project: string;
  /** ISO timestamp of the last successful sync. */
  syncedAt: string;
  /** Health roll-up. */
  state: ProjectState;
  /** false ⇒ the linked folder was moved/renamed at sync time (relink needed). */
  repoPresent: boolean;
}

/** One protocol file's fingerprint — the change-detection unit (sha256 + mtime + size). */
export interface ManifestEntry {
  path: string;
  sha256: string;
  mtime: string;
  bytes: number;
}

export interface SnapshotOverview {
  headline: string;
  state: ProjectState;
  /** What's happening now (one line, from STATUS.md). */
  current: string;
  /** Recent activity, WORKLOG/CHANGELOG folded in. */
  recent: TitledItem[];
  /** What's up next. */
  next: TitledItem[];
  /** Anything blocked. */
  blocked: TitledItem[];
}

/** One CHANGELOG-style entry — drives "what changed". */
export interface ChangeEntry {
  version?: string;
  date?: string;
  items: string[];
}

export type RoadmapStatus = "done" | "active" | "next" | "later";

export interface RoadmapPhase {
  phase: string;
  status: RoadmapStatus;
  detail?: string;
  items: string[];
}

/** A locked decision distilled from BRIEF — what was decided, what was rejected, why. */
export interface DecisionEntry {
  title: string;
  decided?: string;
  rejected?: string;
  why?: string;
}

/** A folder and its role — drives the Structure map's folder legend. */
export interface FolderRole {
  name: string;
  role: string;
}

/** A directed edge in the architecture map (e.g. UI → server → vault). */
export interface FlowEdge {
  from: string;
  to: string;
  label?: string;
}

export interface SnapshotStructure {
  /** Architectural layers, top to bottom (e.g. "React SPA", "Bun server", "markdown vault"). */
  layers: string[];
  folders: FolderRole[];
  dataFlow: FlowEdge[];
}

export interface StackItem {
  name: string;
  role: string;
}

export interface BrandInfo {
  name?: string;
  tagline?: string;
  audience?: string;
  problem?: string;
}

export interface SnapshotDesignFeel {
  stack: StackItem[];
  brand: BrandInfo;
  /** Deterministically extracted (design-tokens tool), never AI-generated. null if none. */
  tokens: DesignTokens | null;
  direction: string;
  principles: string[];
}

/** Protocol-file category — drives Files-tab grouping. */
export type FileCategory =
  | "claude"
  | "status"
  | "brief"
  | "roadmap"
  | "changelog"
  | "worklog"
  | "design"
  | "discoveries"
  | "fundamentals"
  | "brand"
  | "index"
  | "docs";

export interface SnapshotFile {
  /** Repo-relative path, e.g. "agents/STATUS.md". */
  path: string;
  /** Human title, e.g. "Status". */
  title: string;
  category: FileCategory;
  bytes: number;
  lines: number;
  // Note: content is NOT stored on the snapshot — it would balloon the file and
  // cost model output tokens. The Files tab lazy-loads content via
  // GET /engine/project-file (server reads the allowlisted protocol file fresh).
}

export interface ProjectSnapshot {
  meta: SnapshotMeta;
  manifest: ManifestEntry[];
  overview: SnapshotOverview;
  whatChanged: ChangeEntry[];
  roadmap: RoadmapPhase[];
  decisions: DecisionEntry[];
  structure: SnapshotStructure;
  designFeel: SnapshotDesignFeel;
  files: SnapshotFile[];
}

// ── Defensive normalization ──────────────────────────────────────────────────
// The AI emits this JSON, so every field is coerced to a safe shape. Never throw
// on a malformed snapshot — fall back to empties so the dashboard still renders.

const STATES: ProjectState[] = ["healthy", "watch", "blocked", "unknown"];
const ROADMAP_STATUSES: RoadmapStatus[] = ["done", "active", "next", "later"];
const FILE_CATEGORIES: FileCategory[] = [
  "claude",
  "status",
  "brief",
  "roadmap",
  "changelog",
  "worklog",
  "design",
  "discoveries",
  "fundamentals",
  "brand",
  "index",
  "docs",
];

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function bool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function strArr(v: unknown): string[] {
  return arr(v)
    .map((x) => str(x))
    .filter(Boolean);
}

function oneOf<T extends string>(v: unknown, allowed: T[], fallback: T): T {
  return typeof v === "string" && (allowed as string[]).includes(v) ? (v as T) : fallback;
}

function titledItems(v: unknown): TitledItem[] {
  return arr(v).map((raw) => {
    if (typeof raw === "string") return { title: raw };
    const o = obj(raw);
    return { title: str(o.title), detail: o.detail ? str(o.detail) : undefined };
  });
}

function normalizeTokens(v: unknown): DesignTokens | null {
  if (!v || typeof v !== "object") return null;
  const o = obj(v);
  const colorTokens = (x: unknown): DesignTokens["light"] =>
    arr(x).map((c) => {
      const co = obj(c);
      return {
        name: str(co.name),
        value: str(co.value),
        comment: co.comment ? str(co.comment) : undefined,
      };
    });
  const scaleTokens = (x: unknown): DesignTokens["spacing"] =>
    arr(x).map((s) => {
      const so = obj(s);
      return {
        name: str(so.name),
        value: str(so.value),
        pixels: typeof so.pixels === "number" ? so.pixels : undefined,
      };
    });
  const fonts = obj(o.fonts);
  const base = emptyDesignTokens();
  return {
    light: colorTokens(o.light),
    dark: colorTokens(o.dark),
    fonts: {
      families: arr(fonts.families).map((f) => {
        const fo = obj(f);
        return { name: str(fo.name), value: str(fo.value) };
      }),
      scale: scaleTokens(fonts.scale),
    },
    spacing: scaleTokens(o.spacing),
    radius: scaleTokens(o.radius),
    source: oneOf(o.source, ["design.md", "css", "merged", "none"], base.source),
  };
}

/** Coerce a raw parsed object into a fully-formed ProjectSnapshot (never throws). */
export function normalizeSnapshot(raw: unknown): ProjectSnapshot {
  const o = obj(raw);
  const meta = obj(o.meta);
  const overview = obj(o.overview);
  const structure = obj(o.structure);
  const designFeel = obj(o.designFeel);
  const brand = obj(designFeel.brand);

  return {
    meta: {
      project: str(meta.project),
      syncedAt: str(meta.syncedAt),
      state: oneOf(meta.state, STATES, "unknown"),
      repoPresent: bool(meta.repoPresent, true),
    },
    manifest: arr(o.manifest).map((m) => {
      const mo = obj(m);
      return {
        path: str(mo.path),
        sha256: str(mo.sha256),
        mtime: str(mo.mtime),
        bytes: num(mo.bytes),
      };
    }),
    overview: {
      headline: str(overview.headline),
      state: oneOf(overview.state, STATES, "unknown"),
      current: str(overview.current),
      recent: titledItems(overview.recent),
      next: titledItems(overview.next),
      blocked: titledItems(overview.blocked),
    },
    whatChanged: arr(o.whatChanged).map((c) => {
      const co = obj(c);
      return {
        version: co.version ? str(co.version) : undefined,
        date: co.date ? str(co.date) : undefined,
        items: strArr(co.items),
      };
    }),
    roadmap: arr(o.roadmap).map((p) => {
      const po = obj(p);
      return {
        phase: str(po.phase),
        status: oneOf(po.status, ROADMAP_STATUSES, "later"),
        detail: po.detail ? str(po.detail) : undefined,
        items: strArr(po.items),
      };
    }),
    decisions: arr(o.decisions).map((d) => {
      const dec = obj(d);
      return {
        title: str(dec.title),
        decided: dec.decided ? str(dec.decided) : undefined,
        rejected: dec.rejected ? str(dec.rejected) : undefined,
        why: dec.why ? str(dec.why) : undefined,
      };
    }),
    structure: {
      layers: strArr(structure.layers),
      folders: arr(structure.folders).map((f) => {
        const fo = obj(f);
        return { name: str(fo.name), role: str(fo.role) };
      }),
      dataFlow: arr(structure.dataFlow).map((e) => {
        const eo = obj(e);
        return { from: str(eo.from), to: str(eo.to), label: eo.label ? str(eo.label) : undefined };
      }),
    },
    designFeel: {
      stack: arr(designFeel.stack).map((s) => {
        const so = obj(s);
        return { name: str(so.name), role: str(so.role) };
      }),
      brand: {
        name: brand.name ? str(brand.name) : undefined,
        tagline: brand.tagline ? str(brand.tagline) : undefined,
        audience: brand.audience ? str(brand.audience) : undefined,
        problem: brand.problem ? str(brand.problem) : undefined,
      },
      tokens: normalizeTokens(designFeel.tokens),
      direction: str(designFeel.direction),
      principles: strArr(designFeel.principles),
    },
    files: arr(o.files).map((f) => {
      const fo = obj(f);
      return {
        path: str(fo.path),
        title: str(fo.title),
        category: oneOf(fo.category, FILE_CATEGORIES, "docs"),
        bytes: num(fo.bytes),
        lines: num(fo.lines),
      };
    }),
  };
}

/**
 * Extract the single ```json block from a snapshot .md body and parse it into a
 * normalized ProjectSnapshot. Returns null when the body has no parseable JSON
 * (e.g. a never-synced placeholder) — the caller renders the empty state.
 */
export function parseSnapshot(body: string): ProjectSnapshot | null {
  if (!body || !body.trim()) return null;

  // Prefer a fenced ```json block; fall back to the first balanced object.
  const fence = body.match(/```json\s*([\s\S]*?)```/i);
  let jsonText = fence?.[1]?.trim();
  if (!jsonText) {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start >= 0 && end > start) jsonText = body.slice(start, end + 1);
  }
  if (!jsonText) return null;

  try {
    return normalizeSnapshot(JSON.parse(jsonText));
  } catch {
    return null;
  }
}
