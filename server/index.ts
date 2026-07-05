/**
 * Arel OS vault server — a thin Bun HTTP layer over server/io.ts. The vault
 * folder is the backend; this server is the only thing that touches it. The
 * Vite frontend calls these endpoints; ports come from `~/.arelos/config.json`
 * (see server/config.ts).
 *
 * Endpoints (Chapter 2 Contract):
 *   GET  /config                       → { displayName, vaultPort }
 *   GET  /vault/read?path=REL          → { path, frontmatter, body }
 *   GET  /vault/frontmatter?path=REL   → { path, frontmatter }
 *   GET  /vault/list?dir=REL           → { dir, entries }
 *   POST /vault/write   { path, frontmatter, body } → { path, frontmatter }
 *   POST /vault/delete  { path }       → { archivedPath, deleted_from }
 *
 * Arel Clipper ingest (Ch17 — the receiving end for the Chrome extension):
 *   POST /inbox/clip    <ClipperPayload> → { path, frontmatter }   (201)
 *
 * Arel Focus bridge (Ch12 — files live outside the vault):
 *   POST /focus/command  <command obj> → { path }
 *   GET  /focus/state                  → { state | null }
 *   GET  /focus/result?session=ID      → { result | null }
 *
 * No file watcher this chapter (deferred). No indexing/caching.
 */

import { basename } from "node:path";
import { type ClipperPayload, articleCapture, nextInboxId } from "../src/shared/lib/clipper.ts";
import { inboxPath, mediaPath } from "../src/shared/lib/vault/paths.ts";
import { loadConfig } from "./config.ts";
import { type EngineConfig, readEngineConfig, writeEngineConfig } from "./engine/config.ts";
import { runRecipe } from "./engine/engine.ts";
import { getRecipeHealth } from "./engine/health.ts";
import { listRecipes } from "./engine/list.ts";
import { PROTOCOL_PATHS, readProtocol, readProtocolFileContent } from "./engine/project-read.ts";
import { repoPathForSlug } from "./engine/project-repos.ts";
import { readRunRecords } from "./engine/runlog.ts";
import { nextDue, parseTrigger } from "./engine/schedule.ts";
import { mergeSchedulerState, readSchedulerState } from "./engine/scheduler-state.ts";
import {
  FocusBridgeError,
  readFocusResult,
  readFocusState,
  writeFocusCommand,
} from "./focus-bridge.ts";
import {
  VaultNotFoundError,
  VaultPathError,
  listVaultDir,
  readFrontmatter,
  readVaultFile,
  resolveVaultPath,
  saveMediaFile,
  softDeleteVaultFile,
  writeVaultFile,
} from "./io.ts";

const PORT = Number(process.env.ARELOS_VAULT_PORT) || loadConfig().vaultPort;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

/** Map a thrown error to the right HTTP status + JSON body. */
function errorResponse(err: unknown): Response {
  if (err instanceof VaultPathError) return json({ error: err.message }, 403);
  if (err instanceof FocusBridgeError) return json({ error: err.message }, 400);
  if (err instanceof VaultNotFoundError) return json({ error: err.message }, 404);
  const message = err instanceof Error ? err.message : "Internal error";
  return json({ error: message }, 500);
}

interface WriteBody {
  path?: string;
  frontmatter?: Record<string, unknown>;
  body?: string;
}

interface DeleteBody {
  path?: string;
}

interface RunBody {
  name?: string;
  input?: string;
}

/** Maps a focus command name to its bridge filename suffix (contract §5). */
const COMMAND_SUFFIX: Record<string, string> = {
  start_focus_hour: "start",
  update_focus_hour: "update",
  cancel_focus_hour: "cancel",
  rescue_focus_hour: "rescue",
};

async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const { pathname } = url;

  try {
    if (req.method === "GET" && pathname === "/config") {
      const c = loadConfig();
      return json({ displayName: c.displayName, vaultPort: c.vaultPort });
    }

    if (req.method === "GET" && pathname === "/vault/read") {
      const path = url.searchParams.get("path");
      if (!path) return json({ error: "Missing 'path' query param" }, 400);
      return json(await readVaultFile(path));
    }

    if (req.method === "GET" && pathname === "/vault/frontmatter") {
      const path = url.searchParams.get("path");
      if (!path) return json({ error: "Missing 'path' query param" }, 400);
      return json(await readFrontmatter(path));
    }

    if (req.method === "GET" && pathname === "/vault/list") {
      const dir = url.searchParams.get("dir") ?? "";
      return json({ dir, entries: await listVaultDir(dir) });
    }

    if (req.method === "POST" && pathname === "/vault/write") {
      const data = (await req.json()) as WriteBody;
      if (!data.path) return json({ error: "Missing 'path'" }, 400);
      if (!data.frontmatter || typeof data.frontmatter !== "object") {
        return json({ error: "Missing 'frontmatter' object" }, 400);
      }
      return json(await writeVaultFile(data.path, data.frontmatter, data.body ?? ""));
    }

    if (req.method === "POST" && pathname === "/vault/delete") {
      const data = (await req.json()) as DeleteBody;
      if (!data.path) return json({ error: "Missing 'path'" }, 400);
      return json(await softDeleteVaultFile(data.path));
    }

    // ── Arel Clipper ingest (Ch17) ─────────────────────────────────────────
    // The Chrome extension POSTs a ClipperPayload; map it to an inbox resource
    // file (the same mapping the in-app capture uses) so a web clip lands in the
    // Inbox exactly like a manual capture, ready for triage.
    if (req.method === "POST" && pathname === "/inbox/clip") {
      const payload = (await req.json()) as Partial<ClipperPayload>;
      if (!payload.url || typeof payload.url !== "string") {
        return json({ error: "Missing 'url'" }, 400);
      }
      const { frontmatter, body } = articleCapture(payload as ClipperPayload);
      const entries = await listVaultDir("inbox");
      const taken = new Set(
        entries
          .filter((e) => e.type === "file" && e.path.endsWith(".md"))
          .map((e) => e.path.replace(/^inbox\//, "").replace(/\.md$/, "")),
      );
      const id = nextInboxId(String(frontmatter.title ?? "capture"), taken, new Date());
      const res = await writeVaultFile(inboxPath(id), frontmatter, body);
      return json({ path: res.path, frontmatter: res.frontmatter }, 201);
    }

    // ── Arel Focus bridge (Ch12) ───────────────────────────────────────────
    // Write a command file. Body: the full command object (per contract).
    if (req.method === "POST" && pathname === "/focus/command") {
      const cmd = (await req.json()) as { session_id?: string; command?: string };
      if (!cmd.session_id || !cmd.command) {
        return json({ error: "Missing 'session_id' or 'command'" }, 400);
      }
      const suffix = COMMAND_SUFFIX[cmd.command];
      if (!suffix) return json({ error: `Unknown command '${cmd.command}'` }, 400);
      return json(await writeFocusCommand(cmd.session_id, suffix, cmd));
    }

    // Read Arel Focus's current state (null body if not running → standalone).
    if (req.method === "GET" && pathname === "/focus/state") {
      return json({ state: await readFocusState() });
    }

    // Read a finished session's result file (null until Arel Focus writes it).
    if (req.method === "GET" && pathname === "/focus/result") {
      const session = url.searchParams.get("session");
      if (!session) return json({ error: "Missing 'session' query param" }, 400);
      return json({ result: await readFocusResult(session) });
    }

    // ── Engine (recipes) ───────────────────────────────────────────────────
    // List every recipe with its config (enabled/model) and last run.
    if (req.method === "GET" && pathname === "/engine/recipes") {
      return json({ recipes: await listRecipes() });
    }

    // Run a recipe on demand. A run can take ~60–90s; the outcome returns
    // synchronously (no background queue this chapter).
    if (req.method === "POST" && pathname === "/engine/run") {
      const data = (await req.json()) as RunBody;
      if (!data.name) return json({ error: "Missing 'name'" }, 400);
      return json(await runRecipe(data.name, { trigger: "ui", input: data.input }));
    }

    // Read the Engine model config (seeded defaults if config.md is absent).
    if (req.method === "GET" && pathname === "/engine/config") {
      return json(await readEngineConfig());
    }

    // Merge a partial config into the current config and persist it.
    if (req.method === "POST" && pathname === "/engine/config") {
      const data = (await req.json()) as Partial<EngineConfig>;
      const updated = await writeEngineConfig(data);
      // If any recipe's schedule changed, recompute its next_due now so the
      // "next run" reflects the new schedule immediately (not after one tick).
      if (data.recipes) {
        const changedSchedule = Object.entries(data.recipes).filter(
          ([, cfg]) => cfg && Object.hasOwn(cfg, "schedule"),
        );
        if (changedSchedule.length) {
          const recipes = await listRecipes();
          const state = await readSchedulerState();
          const patch: Record<string, (typeof state)[string]> = {};
          for (const [rname] of changedSchedule) {
            const item = recipes.find((r) => r.name === rname);
            const rule = item ? parseTrigger(item.schedule ?? item.trigger) : null;
            const entry = state[rname] ?? { next_due: null, last_fired: null, last_status: null };
            patch[rname] = {
              ...entry,
              next_due: rule ? nextDue(rule, new Date()).toISOString() : null,
            };
          }
          await mergeSchedulerState(patch);
        }
      }
      return json(updated);
    }

    // Run history for a single recipe (newest-first, capped at limit).
    if (req.method === "GET" && pathname === "/engine/runs") {
      const recipe = url.searchParams.get("recipe");
      if (!recipe) return json({ error: "Missing 'recipe' query param" }, 400);
      const limitParam = url.searchParams.get("limit");
      const limit = limitParam ? Math.max(1, Math.min(500, Number(limitParam))) : 50;
      return json({ runs: await readRunRecords(recipe, limit) });
    }

    // Scheduler state — next_due + last_fired per recipe (for UI display).
    if (req.method === "GET" && pathname === "/engine/schedule") {
      return json(await readSchedulerState());
    }

    // Live dependency health. With ?recipe=<name> → that recipe's health; without
    // → every recipe's health (for the index table's at-a-glance status dot).
    // ?fresh=1 bypasses the short probe cache (used by the manual "Re-check").
    if (req.method === "GET" && pathname === "/engine/health") {
      const fresh = url.searchParams.get("fresh") === "1";
      const recipe = url.searchParams.get("recipe");
      if (recipe) return json(await getRecipeHealth(recipe, fresh));
      const recipes = await listRecipes();
      const reports = await Promise.all(recipes.map((r) => getRecipeHealth(r.name, fresh)));
      const byName: Record<string, Awaited<ReturnType<typeof getRecipeHealth>>> = {};
      for (const report of reports) byName[report.recipe] = report;
      return json(byName);
    }

    // Validate a candidate repo folder when linking a software project (D64). The
    // user pastes an absolute path; this reports whether the folder exists and how
    // many project-protocol files it has — pre-save feedback, no allowlist yet.
    if (req.method === "GET" && pathname === "/engine/repo-check") {
      const path = url.searchParams.get("path");
      if (!path) return json({ error: "Missing 'path' query param" }, 400);
      const result = await readProtocol(path);
      return json({
        exists: result.status === "ok",
        protocolCount: result.files.length,
        name: basename(path),
      });
    }

    // Lazy file content for the Files tab. Guarded twice: the path must be a known
    // protocol file, and the slug must be a linked software project (its saved
    // repo_path is the only folder read). The dashboard never reads code.
    if (req.method === "GET" && pathname === "/engine/project-file") {
      const slug = url.searchParams.get("slug");
      const path = url.searchParams.get("path");
      if (!slug || !path) return json({ error: "Missing 'slug' or 'path'" }, 400);
      if (!PROTOCOL_PATHS.has(path)) return json({ error: "Not a protocol file" }, 403);
      const repoPath = await repoPathForSlug(slug);
      if (!repoPath) return json({ error: "Not a linked software project" }, 404);
      const content = await readProtocolFileContent(repoPath, path);
      if (content === null) return json({ error: "File not found" }, 404);
      return json({ path, content });
    }

    // Media upload: multipart form with a `file` field → saved under media/.
    if (req.method === "POST" && pathname === "/vault/upload") {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return json({ error: "Missing 'file'" }, 400);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { relativePath, filename } = await saveMediaFile(file.name, bytes);
      return json({
        url: `${url.origin}/media/${filename}`,
        name: file.name,
        size: file.size,
        type: file.type,
        key: relativePath,
      });
    }

    // Serve uploaded media files.
    if (req.method === "GET" && pathname.startsWith("/media/")) {
      const filename = decodeURIComponent(pathname.slice("/media/".length));
      const abs = resolveVaultPath(mediaPath(filename));
      const bunFile = Bun.file(abs);
      if (!(await bunFile.exists())) return json({ error: "Not found" }, 404);
      return new Response(bunFile, {
        headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=31536000, immutable" },
      });
    }

    return json({ error: `Not found: ${req.method} ${pathname}` }, 404);
  } catch (err) {
    return errorResponse(err);
  }
}

const server = Bun.serve({ port: PORT, fetch: handle });

console.log(`Arel OS vault server → http://localhost:${server.port}`);

// ── In-process scheduler ───────────────────────────────────────────────────
// Ticks every 60s. Fires recipes whose next_due is in the past (catch-up is
// free: after sleep/shutdown the first tick sees a past next_due and fires once,
// then advances to the next *future* slot — no backfill storm for missed slots).
// An in-flight Set prevents overlap: a recipe already running is skipped.

const inFlight = new Set<string>();

async function schedulerTick(): Promise<void> {
  const now = new Date();
  try {
    const [recipes, config, state] = await Promise.all([
      listRecipes(),
      readEngineConfig(),
      readSchedulerState(),
    ]);

    for (const recipe of recipes) {
      // Skip disabled recipes.
      const recipeConfig = config.recipes[recipe.name];
      if (recipeConfig?.enabled === false) continue;

      // Prefer the explicit `schedule` field (e.g. cron) over the `trigger` word.
      const rule = parseTrigger(recipe.schedule ?? recipe.trigger);
      if (!rule) continue; // on-demand / manual / unparseable — never auto-fire

      if (inFlight.has(recipe.name)) continue; // already running

      const entry = state[recipe.name] ?? { next_due: null, last_fired: null, last_status: null };

      // Seed next_due on first encounter.
      if (!entry.next_due) {
        await mergeSchedulerState({
          [recipe.name]: { ...entry, next_due: nextDue(rule, now).toISOString() },
        });
        continue;
      }

      const due = new Date(entry.next_due);
      if (now < due) continue; // not yet due

      // Fire — do not await; log errors; advance next_due when done.
      inFlight.add(recipe.name);
      const firedAt = new Date();
      runRecipe(recipe.name, { trigger: "scheduled" })
        .then(async (outcome) => {
          // Advance to the next *future* slot (skip any intermediate slots missed
          // during a long sleep — fire once, not once-per-missed-slot).
          let slot = nextDue(rule, firedAt);
          const nowAfter = new Date();
          while (slot <= nowAfter) slot = nextDue(rule, slot);
          await mergeSchedulerState({
            [recipe.name]: {
              next_due: slot.toISOString(),
              last_fired: firedAt.toISOString(),
              last_status: outcome.status,
            },
          });
        })
        .catch((err: unknown) => {
          console.error(`[scheduler] ${recipe.name} error:`, err);
        })
        .finally(() => {
          inFlight.delete(recipe.name);
        });
    }
  } catch (err) {
    console.error("[scheduler] tick error:", err);
  }
}

// Immediate tick for catch-up on startup, then every 60s.
schedulerTick().catch(console.error);
setInterval(() => schedulerTick().catch(console.error), 60_000);
