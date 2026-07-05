/**
 * Recipe loader — reads a recipe's SKILL.md (frontmatter + body) and the shared
 * vault glossary (system/recipes/context.md), reusing the vault I/O layer so the
 * Engine never touches the filesystem directly. Frontmatter fields are read
 * defensively (a recipe is hand/skill-creator-authored markdown, not a typed doc).
 */

import { recipeSkillPath, recipesContextPath } from "../../src/shared/lib/vault/paths.ts";
import { VaultNotFoundError, readVaultFile } from "../io.ts";
import type { Recipe, RecipeMeta } from "./types.ts";

/** Coerce a frontmatter value into a clean string[] — accepts a YAML list or a comma string. */
function toList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/** Load and parse a recipe by name from system/recipes/<name>/. */
export async function loadRecipe(name: string): Promise<Recipe> {
  const skill = await readVaultFile(recipeSkillPath(name));
  const fm = skill.frontmatter as unknown as Record<string, unknown>;

  const meta: RecipeMeta = {
    name: typeof fm.name === "string" && fm.name.trim() ? fm.name.trim() : name,
    description: typeof fm.description === "string" ? fm.description : undefined,
    model: typeof fm.model === "string" && fm.model.trim() ? fm.model.trim() : undefined,
    fallback: toList(fm.fallback),
    allowedTools: toList(fm["allowed-tools"] ?? fm.allowedTools),
    trigger: typeof fm.trigger === "string" && fm.trigger.trim() ? fm.trigger.trim() : "on-demand",
    schedule:
      typeof fm.schedule === "string" && fm.schedule.trim() ? fm.schedule.trim() : undefined,
  };

  let context = "";
  try {
    const ctx = await readVaultFile(recipesContextPath());
    context = ctx.body.trim();
  } catch (err) {
    if (!(err instanceof VaultNotFoundError)) throw err;
  }

  return { name, meta, body: skill.body.trim(), context };
}
