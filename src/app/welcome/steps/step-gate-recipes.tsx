/**
 * Step 7 — GATE: Recipes (spec §3 Step 7, §gates). Opt-in. Reads the two
 * shipped recipes live from `GET /engine/recipes` (via `useRecipes`, the same
 * hook the Recipes page uses) plus their live health from `GET /engine/health`
 * (`useAllHealth`). Enabling a recipe calls `setRecipeEnabled`, which is the
 * exact `POST /engine/config { recipes: { <name>: { enabled } } }` path
 * `recipes-page.tsx` uses — no new persistence.
 *
 * Honest dependency notes are hardcoded per spec (finance-sync needs Gmail +
 * an AI key; project-sync needs a linked project) rather than parsed from
 * SKILL.md, since the SKILL.md `description` frontmatter is verbose/authoring
 * prose, not user-facing copy — `RecipeListItem.description` (surfaced by
 * `GET /engine/recipes`) IS that same frontmatter description, shown verbatim
 * as a secondary line so nothing is duplicated or invented.
 */

import { useAllHealth } from "@/app/recipes/use-health";
import { useRecipes } from "@/app/recipes/use-recipes";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Switch } from "@/shared/components/ui/switch";
import type { HealthStatus } from "@/shared/lib/engine/client";
import { useState } from "react";

const HONEST_NOTES: Record<string, string> = {
  "finance-sync":
    "Reads your Gmail and files new transactions into your finance tables. Needs Gmail connected (an advanced step) and an AI key before it can actually run.",
  "project-sync":
    "Pulls status from your linked software projects into a dashboard. Needs at least one linked project.",
};

function HealthDot({ overall, enabled }: { overall: HealthStatus | undefined; enabled: boolean }) {
  if (!enabled) return <span className="text-caption text-muted-foreground">Off</span>;
  if (overall === undefined) {
    return <span className="size-2 rounded-full bg-muted-foreground/40" />;
  }
  const map: Record<HealthStatus, string> = {
    ok: "bg-success",
    warn: "bg-warning",
    down: "bg-error",
  };
  return <span className={`size-2 rounded-full ${map[overall]}`} />;
}

export function StepGateRecipes({
  onNext,
}: {
  onNext: (result: { accepted: boolean; enabledCount: number }) => void;
}) {
  const [gateOpen, setGateOpen] = useState(false);
  const { recipes, loading, setRecipeEnabled } = useRecipes();
  const health = useAllHealth();

  const decline = () => onNext({ accepted: false, enabledCount: 0 });
  const finish = () => {
    const enabledCount = recipes.filter((r) => r.enabled).length;
    onNext({ accepted: true, enabledCount });
  };

  if (!gateOpen) {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <h1 className="text-heading font-semibold">
            Let Arel do some work for you — automatically.
          </h1>
          <p className="text-body text-muted-foreground">
            Recipes are little automations the built-in Engine runs on a schedule — no chat, no
            clicking. Two come ready to go. Want to see them?
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setGateOpen(true)}>Show me recipes</Button>
          <Button variant="ghost" onClick={decline}>
            Not now
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-heading font-semibold">Two recipes, ready when you are.</h1>
        <p className="text-body text-muted-foreground">
          Enabling is safe even when a dependency isn't set up yet — it just won't fire until it's
          healthy.
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <div className="space-y-3">
          {recipes.map((recipe) => (
            <div
              key={recipe.name}
              className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <HealthDot overall={health[recipe.name]?.overall} enabled={recipe.enabled} />
                  <span className="font-medium text-body">{recipe.name}</span>
                </div>
                <p className="text-caption text-muted-foreground">
                  {HONEST_NOTES[recipe.name] ?? recipe.description}
                </p>
              </div>
              <Switch
                checked={recipe.enabled}
                onCheckedChange={(checked) => setRecipeEnabled(recipe.name, checked)}
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button onClick={finish}>Done with recipes →</Button>
      </div>
    </div>
  );
}
