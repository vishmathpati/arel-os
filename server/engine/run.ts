/**
 * On-demand CLI entrypoint for the Engine (v1).
 *
 *   bun server/engine/run.ts <recipe-name> [task input...]
 *   e.g. bun server/engine/run.ts project-summary channel-rebrand
 *
 * Reads AI_GATEWAY_API_KEY + ARELOS_ENGINE_MODEL from the environment (Bun loads
 * .env automatically). This is the same `runRecipe` entrypoint the UI/chat and
 * launchd triggers will call later — only the trigger differs.
 */

import { runRecipe } from "./engine.ts";

const [name, ...rest] = process.argv.slice(2);

if (!name) {
  console.error("usage: bun server/engine/run.ts <recipe-name> [task input...]");
  process.exit(1);
}

const input = rest.join(" ");
const outcome = await runRecipe(name, { trigger: "manual", input });

console.log(
  `${outcome.status.toUpperCase()} · ${outcome.model} · ${(outcome.durationMs / 1000).toFixed(1)}s · ${outcome.summary}`,
);
if (outcome.text) console.log(`\n${outcome.text}`);

process.exit(outcome.status === "ok" ? 0 : 1);
