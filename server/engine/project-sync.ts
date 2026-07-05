/**
 * project-sync synthesis path (D65) — the structured-output replacement for the
 * generic free-form tool loop, dispatched by name from runRecipe.
 *
 * Why this exists: project-sync's old run drove the whole algorithm through the
 * model in a 12-step generateText loop. project-read returns the full markdown of
 * a dozen protocol files, which the loop re-sent on every step (~974k tokens for
 * one project), and the model hand-authored a 1684-line JSON object — verbatim
 * manifest/files/tokens included — which dropped a brace and parsed to nothing.
 *
 * The fix: the orchestration here is MECHANICAL, so it runs in code (the same
 * "mechanical → code" move finance-sync used). The model is used for exactly one
 * thing per *changed* project — a single `generateObject` that authors only the
 * prose fields against `AuthoredSnapshotSchema`. The protocol contents are sent
 * once; manifest/files/tokens never pass through the model; `syncedAt` is stamped
 * server-side. Result: schema-valid snapshots at ~one read + one generation.
 *
 * Read-only and one-way (D63): reads a linked project's protocol docs + a token
 * parse, writes a snapshot (and a relink task on a missing folder) into the vault.
 * Never writes a repo, never reads code.
 */

import { generateObject } from "ai";
import { parseSnapshot } from "../../src/shared/lib/project-dashboard/snapshot.ts";
import type { ProjectSnapshot } from "../../src/shared/lib/project-dashboard/snapshot.ts";
import { projectPath, projectSnapshotPath, taskPath } from "../../src/shared/lib/vault/paths.ts";
import type { ProjectFrontmatter } from "../../src/shared/lib/vault/schemas.ts";
import { VaultNotFoundError, readVaultFile, writeVaultFile } from "../io.ts";
import { extractDesignTokens } from "./design-tokens.ts";
import { readProtocol } from "./project-read.ts";
import { listSoftwareProjects, repoPathForSlug } from "./project-repos.ts";
import { AuthoredSnapshotSchema, assembleSnapshot } from "./snapshot-schema.ts";
import type { Recipe, VaultChange } from "./types.ts";

export interface ProjectSyncOptions {
  recipe: Recipe;
  /** Resolved primary model slug (gateway). */
  model: string;
  /** Resolved fallback model slugs. */
  fallbacks: string[];
  /** Task input: a single project slug, or empty for "sync all linked software projects". */
  input?: string;
  /** Collector for vault writes, wired into the run's changeset. */
  onChange: (c: VaultChange) => void;
}

export interface ProjectSyncResult {
  totalTokens: number;
  summary: string;
}

/** One project's outcome, for the run summary. */
type Outcome = "rebuilt" | "unchanged" | "relink" | "skipped";

/** Serialize a snapshot to the on-disk doc shape: light frontmatter + one ```json block. */
async function writeSnapshot(
  slug: string,
  snapshot: ProjectSnapshot,
  onChange: (c: VaultChange) => void,
): Promise<void> {
  const body = ["```json", JSON.stringify(snapshot, null, 2), "```"].join("\n");
  const res = await writeVaultFile(
    projectSnapshotPath(slug),
    { type: "project-snapshot", project: slug, syncedAt: snapshot.meta.syncedAt },
    body,
  );
  onChange({ op: "updated", path: res.path, kind: "snapshot", label: slug });
}

/** Load the prior snapshot (for its manifest + reuse on unchanged/missing runs); null if first sync. */
async function loadPriorSnapshot(slug: string): Promise<ProjectSnapshot | null> {
  try {
    const doc = await readVaultFile(projectSnapshotPath(slug));
    return parseSnapshot(doc.body);
  } catch (err) {
    if (err instanceof VaultNotFoundError) return null;
    throw err;
  }
}

/** Write a todo task asking the user to relink a project whose folder went missing. */
async function writeRelinkTask(slug: string, onChange: (c: VaultChange) => void): Promise<void> {
  let area = "learning";
  let title = slug;
  try {
    const proj = await readVaultFile(projectPath(slug));
    const fm = proj.frontmatter as unknown as ProjectFrontmatter;
    if (typeof fm.area === "string" && fm.area.trim()) area = fm.area;
    if (typeof fm.title === "string" && fm.title.trim()) title = fm.title;
  } catch {
    // project unreadable — fall back to defaults
  }
  const res = await writeVaultFile(
    taskPath(`relink-${slug}`),
    { type: "task", status: "todo", area, title: `Relink ${title} — folder moved` },
    `The linked folder for **${title}** no longer resolves on disk. Re-link the project's folder from its project page so its dashboard can sync again.`,
  );
  onChange({ op: "updated", path: res.path, kind: "task", label: title });
}

/** The authored (prose) subset of a prior snapshot — the merge base for a delta re-sync. */
function authoredSubset(prior: ProjectSnapshot) {
  return {
    overview: prior.overview,
    whatChanged: prior.whatChanged,
    roadmap: prior.roadmap,
    decisions: prior.decisions,
    structure: prior.structure,
    // designFeel minus tokens (tokens are deterministic, never model-authored).
    designFeel: {
      stack: prior.designFeel.stack,
      brand: prior.designFeel.brand,
      direction: prior.designFeel.direction,
      principles: prior.designFeel.principles,
    },
  };
}

/**
 * Build the `generateObject` system + prompt for one project. Pure (no model
 * call, no I/O) so the delta-vs-full prompt assembly is unit-testable.
 *
 * Full synthesis (no prior): send every protocol doc, author from scratch.
 * Delta re-sync (prior exists): send the prior snapshot's authored fields as a
 * merge base + ONLY the changed files' contents, and instruct the model to carry
 * unaffected fields forward verbatim (and to drop a changed-but-absent file's
 * contributions, since absence ⇒ removed).
 */
export function buildSynthesisInput(
  slug: string,
  prior: ProjectSnapshot | null,
  read: Pick<Awaited<ReturnType<typeof readProtocol>>, "contents" | "changed">,
): { system: string; prompt: string } {
  const isDelta = prior !== null;
  const changed = new Set(read.changed);
  // On a delta, only the changed files are sent; on a first sync, changed == all files.
  const sendContents = isDelta ? read.contents.filter((c) => changed.has(c.path)) : read.contents;
  const docs = sendContents.map((c) => `## ${c.title}\n\n${c.content}`).join("\n\n---\n\n");

  const note = isDelta
    ? "[Engine] Structured synthesis mode — DELTA UPDATE. The orchestration, change-detection, " +
      "the verbatim manifest/files/design-tokens, the syncedAt timestamp, and the vault write are " +
      "ALL handled by the Engine in code — you do NOT call tools and you do NOT emit manifest, " +
      "files, or tokens. Below is the PRIOR snapshot's authored fields (the merge base) followed by " +
      "ONLY the protocol files that changed since it. Return the COMPLETE authored object: start " +
      "from the merge base, apply updates derived solely from the changed files, and carry every " +
      "unaffected field forward UNCHANGED. 'whatChanged' should reflect this delta (the changed " +
      "files). If a path is listed as changed but is absent from the changed documents below, that " +
      "file was REMOVED — drop whatever it contributed to the merge base."
    : "[Engine] Structured synthesis mode. The orchestration, change-detection, the verbatim " +
      "manifest/files/design-tokens, the syncedAt timestamp, and the vault write are ALL handled " +
      "by the Engine in code — you do NOT call tools and you do NOT emit manifest, files, or tokens. " +
      "Your only job is to author the snapshot's prose fields from the protocol documents below, " +
      "returned as the structured object, following the 'where to source each field' guidance above. " +
      "If the docs don't support a field, leave it empty.";

  const promptParts: string[] = [];
  if (isDelta && prior) {
    promptParts.push(
      `Update the dashboard snapshot for the "${slug}" project.`,
      `Changed files since the last snapshot: ${read.changed.join(", ") || "(none)"}.`,
      `Merge base — the prior snapshot's authored fields (carry unaffected fields forward verbatim):\n\n${JSON.stringify(
        authoredSubset(prior),
        null,
        2,
      )}`,
      `Changed documents:\n\n${docs}`,
    );
  } else {
    promptParts.push(
      `Author the dashboard snapshot for the "${slug}" project from its protocol documents:\n\n${docs}`,
    );
  }

  return { system: note, prompt: promptParts.join("\n\n---\n\n") };
}

/** Synthesize one changed project's snapshot via a single structured generation. Returns tokens used. */
async function synthesize(
  slug: string,
  repoPath: string,
  read: Awaited<ReturnType<typeof readProtocol>>,
  prior: ProjectSnapshot | null,
  opts: ProjectSyncOptions,
): Promise<number> {
  const tokens = await extractDesignTokens(repoPath);

  const built = buildSynthesisInput(slug, prior, read);
  const system = [opts.recipe.context, opts.recipe.body, built.system]
    .filter(Boolean)
    .join("\n\n---\n\n");

  const { object, usage } = await generateObject({
    model: opts.model,
    schema: AuthoredSnapshotSchema,
    system,
    prompt: built.prompt,
    providerOptions: {
      gateway: { caching: "auto", ...(opts.fallbacks.length ? { models: opts.fallbacks } : {}) },
    },
  });

  const snapshot = assembleSnapshot(object, {
    project: slug,
    syncedAt: new Date().toISOString(),
    repoPresent: true,
    manifest: read.manifest,
    files: read.files,
    tokens,
  });
  await writeSnapshot(slug, snapshot, opts.onChange);
  return usage?.totalTokens ?? 0;
}

/** Resolve which projects to sync: one slug, or every linked software project. */
async function resolveTargets(input?: string): Promise<{ slug: string; repoPath: string }[]> {
  const slug = input?.trim();
  if (slug) {
    const repoPath = await repoPathForSlug(slug);
    return repoPath ? [{ slug, repoPath }] : [];
  }
  return (await listSoftwareProjects()).map((p) => ({ slug: p.slug, repoPath: p.repoPath }));
}

/**
 * Run project-sync. Mechanical orchestration in code; one structured generation
 * per changed project. Always resolves (per-project failures are counted, not
 * thrown — one bad project can't sink the rest).
 */
export async function runProjectSync(opts: ProjectSyncOptions): Promise<ProjectSyncResult> {
  const targets = await resolveTargets(opts.input);
  if (targets.length === 0) {
    return { totalTokens: 0, summary: "no linked software projects to sync" };
  }

  let totalTokens = 0;
  const counts: Record<Outcome, number> = { rebuilt: 0, unchanged: 0, relink: 0, skipped: 0 };

  for (const { slug, repoPath } of targets) {
    try {
      const prior = await loadPriorSnapshot(slug);
      const read = await readProtocol(repoPath, prior?.manifest);

      if (read.status === "folder-missing") {
        // Keep the prior snapshot's content but flag the folder gone; queue a relink.
        const base =
          prior ??
          assembleSnapshot(
            {
              overview: {
                headline: "",
                state: "unknown",
                current: "",
                recent: [],
                next: [],
                blocked: [],
              },
              whatChanged: [],
              roadmap: [],
              decisions: [],
              structure: { layers: [], folders: [], dataFlow: [] },
              designFeel: {
                stack: [],
                brand: { name: null, tagline: null, audience: null, problem: null },
                direction: "",
                principles: [],
              },
            },
            {
              project: slug,
              syncedAt: "",
              repoPresent: false,
              manifest: [],
              files: [],
              tokens: null,
            },
          );
        const snapshot: ProjectSnapshot = {
          ...base,
          meta: {
            ...base.meta,
            project: slug,
            syncedAt: new Date().toISOString(),
            repoPresent: false,
          },
        };
        await writeSnapshot(slug, snapshot, opts.onChange);
        await writeRelinkTask(slug, opts.onChange);
        counts.relink += 1;
        continue;
      }

      if (read.unchanged && prior) {
        // Nothing changed — bump the timestamp only, keep everything else byte-for-byte.
        const snapshot: ProjectSnapshot = {
          ...prior,
          meta: {
            ...prior.meta,
            project: slug,
            syncedAt: new Date().toISOString(),
            repoPresent: true,
          },
        };
        await writeSnapshot(slug, snapshot, opts.onChange);
        counts.unchanged += 1;
        continue;
      }

      totalTokens += await synthesize(slug, repoPath, read, prior, opts);
      counts.rebuilt += 1;
    } catch {
      counts.skipped += 1;
    }
  }

  const parts = (Object.entries(counts) as [Outcome, number][])
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${k}`);
  const summary = `synced ${targets.length} project${targets.length === 1 ? "" : "s"} (${
    parts.join(", ") || "no changes"
  })`;
  return { totalTokens, summary };
}
