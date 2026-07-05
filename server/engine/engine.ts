/**
 * The Engine — runs a Recipe end to end. One entrypoint, `runRecipe(name)`,
 * is what both the on-demand triggers (CLI now; UI/chat later) and scheduled
 * triggers (launchd, v1.1) call. The flow:
 *
 *   load recipe → build its allowed tools → assemble system prompt (shared
 *   context.md + the SKILL.md body) → run the AI-SDK tool-use loop on the
 *   resolved model (+ fallbacks) → append a debug-grade line to the recipe's
 *   log.md → return the outcome.
 *
 * The model is NEVER hard-coded: it comes from the recipe's `model` field or the
 * ARELOS_ENGINE_MODEL env var (a Vercel AI Gateway slug). Auth is the
 * AI_GATEWAY_API_KEY env var, which the AI SDK reads automatically.
 */

import { generateText, stepCountIs } from "ai";
import { readEngineConfig } from "./config.ts";
import { appendRunLog } from "./log.ts";
import { type ProjectSyncOptions, type ProjectSyncResult, runProjectSync } from "./project-sync.ts";
import { loadRecipe } from "./recipe.ts";
import { appendRunRecord, readRunRecords } from "./runlog.ts";
import { buildTools } from "./tools.ts";
import type { RunOutcome, VaultChange } from "./types.ts";

const MAX_STEPS = Number(process.env.ARELOS_ENGINE_MAX_STEPS ?? 12);

/**
 * Recipes whose artifact is a single structured document, not a free-form set of
 * vault writes, run a dedicated synthesis path instead of the generic tool loop:
 * the orchestration is mechanical (code) and the model is used for exactly one
 * `generateObject` per changed item (D65). Every other recipe (finance-sync, …)
 * still runs the multi-step generateText loop below, untouched.
 */
type SynthesisHandler = (opts: ProjectSyncOptions) => Promise<ProjectSyncResult>;
const SYNTHESIS_HANDLERS: Record<string, SynthesisHandler> = { "project-sync": runProjectSync };

function envList(value: string | undefined): string[] {
  return value
    ? value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
}

function firstLine(text: string, max = 160): string {
  const line = text.trim().split("\n")[0] ?? "";
  return line.length > max ? `${line.slice(0, max)}…` : line;
}

export interface RunOptions {
  /** Where the run came from — recorded in the log. */
  trigger?: string;
  /** The task message handed to the model (e.g. which project to summarize). */
  input?: string;
}

/** Run a recipe by name. Always resolves to a RunOutcome (failures are logged, not thrown). */
export async function runRecipe(name: string, opts: RunOptions = {}): Promise<RunOutcome> {
  const trigger = opts.trigger ?? "manual";
  const startedAt = Date.now();

  let model = "(unset)";
  try {
    const recipe = await loadRecipe(name);
    const config = await readEngineConfig();
    const recipeConfig = config.recipes[name];

    // A disabled recipe is refused before any model work — logged, not thrown.
    if (recipeConfig?.enabled === false) {
      const outcome: RunOutcome = {
        status: "failed",
        trigger,
        model: "(disabled)",
        durationMs: Date.now() - startedAt,
        totalTokens: 0,
        summary: `recipe disabled: ${name} is turned off in the Engine config`,
      };
      await appendRunLog(name, outcome).catch(() => {});
      return outcome;
    }

    // Resolution order: config override → recipe SKILL.md → global default → env.
    model =
      recipeConfig?.model ??
      recipe.meta.model ??
      config.defaultModel ??
      process.env.ARELOS_ENGINE_MODEL ??
      "";
    if (!model) {
      throw new Error(
        "No model resolved — set the recipe's `model`, the Engine config defaultModel, or the ARELOS_ENGINE_MODEL env var to a Vercel AI Gateway slug (e.g. deepseek/...).",
      );
    }
    // Fallback order: per-recipe override → global config fallback → recipe SKILL.md → env list.
    const fallbacks = recipeConfig?.fallback
      ? [recipeConfig.fallback]
      : config.fallbackModel
        ? [config.fallbackModel]
        : recipe.meta.fallback.length
          ? recipe.meta.fallback
          : envList(process.env.ARELOS_ENGINE_FALLBACK);

    // Collect vault writes during this run for the changeset record.
    const changes: VaultChange[] = [];

    // Structured-synthesis recipes (project-sync) skip the free-form tool loop:
    // mechanical orchestration in code + one generateObject per changed item.
    const handler = SYNTHESIS_HANDLERS[name];
    if (handler) {
      const { totalTokens, summary } = await handler({
        recipe,
        model,
        fallbacks,
        input: opts.input?.trim() || undefined,
        onChange: (c) => changes.push(c),
      });
      const finishedAt = new Date().toISOString();
      const outcome: RunOutcome = {
        status: "ok",
        trigger,
        model,
        durationMs: Date.now() - startedAt,
        totalTokens,
        summary,
        changes,
      };
      await Promise.all([
        appendRunLog(name, outcome),
        appendRunRecord(name, { at: finishedAt, ...outcome, changes }).catch(() => {}),
      ]);
      return outcome;
    }

    const system = [recipe.context, recipe.body].filter(Boolean).join("\n\n---\n\n");

    // Incremental email window: for recipes that read Gmail, only scan since 1h
    // before the last *successful* run (instead of a fixed 2-day rescan). Falls
    // back to whatever the recipe's SKILL.md says when there's no prior run.
    let prompt = opts.input?.trim() || `Run the ${name} recipe.`;
    if (recipe.meta.allowedTools.includes("gws")) {
      const prior = await readRunRecords(name, 30).catch(() => []);
      const lastOk = prior.find((r) => r.status === "ok");
      if (lastOk) {
        const sinceMs = new Date(lastOk.at).getTime() - 3_600_000;
        if (Number.isFinite(sinceMs)) {
          const epoch = Math.floor(sinceMs / 1000);
          prompt += `\n\n[Engine] Incremental email window: scan Gmail with \`after:${epoch}\` — that is 1 hour before the last successful run (${lastOk.at}). Do NOT use newer_than:2d; dedup by message-id still applies.`;
        }
      }
    }

    const result = await generateText({
      model,
      system,
      prompt,
      tools: buildTools(recipe.meta.allowedTools, (c) => changes.push(c)),
      stopWhen: stepCountIs(MAX_STEPS),
      // caching:'auto' lets the gateway cache the stable prompt prefix (Anthropic
      // gets a cache_control breakpoint; OpenAI/DeepSeek cache implicitly).
      providerOptions: {
        gateway: { caching: "auto", ...(fallbacks.length ? { models: fallbacks } : {}) },
      },
    });

    const finishedAt = new Date().toISOString();
    const cachedTokens = result.totalUsage?.cachedInputTokens ?? 0;
    const outcome: RunOutcome = {
      status: "ok",
      trigger,
      model,
      durationMs: Date.now() - startedAt,
      totalTokens: result.totalUsage?.totalTokens ?? 0,
      cachedTokens,
      summary: firstLine(result.text) || `done (${result.steps.length} steps)`,
      text: result.text,
      changes,
    };
    await Promise.all([
      appendRunLog(name, outcome),
      appendRunRecord(name, { at: finishedAt, ...outcome, changes: outcome.changes ?? [] }).catch(
        () => {},
      ),
    ]);
    return outcome;
  } catch (err) {
    const finishedAt = new Date().toISOString();
    const outcome: RunOutcome = {
      status: "failed",
      trigger,
      model,
      durationMs: Date.now() - startedAt,
      totalTokens: 0,
      summary: `error: ${err instanceof Error ? err.message : String(err)}`,
      changes: [],
    };
    // Best-effort log; never mask the original failure with a logging error.
    await Promise.all([
      appendRunLog(name, outcome).catch(() => {}),
      appendRunRecord(name, { at: finishedAt, ...outcome, changes: outcome.changes ?? [] }).catch(
        () => {},
      ),
    ]);
    return outcome;
  }
}
