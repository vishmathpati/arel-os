/**
 * Step 2 — Areas. SPEC OVERRIDE: the spec's original Step 2 taught six locked
 * areas (`AREA_OPTIONS`); that constant no longer exists — top-level areas are
 * fully user-defined (area-data.ts::createArea). This step has the user CREATE
 * their own first areas instead: four starter ideas as one-click chips, plus
 * free-form add via the real `NewAreaDialog`. Advancing requires ≥1 area to
 * exist (this step doubly serves as the wizard's auto-launch condition per
 * task brief: topLevelAreas.length === 0).
 */

import { useAreasContext } from "@/app/areas/areas-provider";
import { NewAreaDialog } from "@/app/areas/new-area-dialog";
import { Button } from "@/shared/components/ui/button";
import { useState } from "react";

const STARTER_AREAS = [
  { name: "Health", hint: "workouts, meals, sleep, doctor visits" },
  { name: "Work", hint: "your job, clients, career" },
  { name: "Finance", hint: "accounts, subscriptions, spending" },
  { name: "Learning", hint: "courses, books, skills you're building" },
] as const;

export function StepAreas({ onNext }: { onNext: () => void }) {
  const { topLevelAreas, create } = useAreasContext();
  const [creating, setCreating] = useState<string | null>(null);

  const existingNames = new Set(topLevelAreas.map((a) => a.name.toLowerCase()));

  const addStarter = async (name: string) => {
    setCreating(name);
    await create({ name });
    setCreating(null);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-heading font-semibold">Everything lives in an Area.</h1>
        <p className="text-body text-muted-foreground">
          An Area is a permanent part of your life — it never "finishes." Every task, project, and
          note belongs to exactly one Area, so nothing ever gets lost. Pick a few to start, or add
          your own.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {STARTER_AREAS.map((starter) => {
          const already = existingNames.has(starter.name.toLowerCase());
          return (
            <button
              key={starter.name}
              type="button"
              disabled={already || creating === starter.name}
              onClick={() => addStarter(starter.name)}
              className="flex flex-col items-start gap-0.5 rounded-md border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-hover disabled:cursor-default disabled:opacity-60"
            >
              <span className="text-body font-medium">
                {starter.name}
                {already && <span className="ml-2 text-caption text-success">Added</span>}
              </span>
              <span className="text-caption text-muted-foreground">
                for things like {starter.hint}
              </span>
            </button>
          );
        })}
      </div>

      {topLevelAreas.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-caption font-medium text-muted-foreground">Your areas so far</p>
          <div className="flex flex-wrap gap-2">
            {topLevelAreas.map((a) => (
              <span
                key={a.slug}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-caption"
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: a.color }} />
                {a.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <NewAreaDialog
          onCreate={create}
          trigger={
            <Button variant="outline" size="sm">
              Add my own
            </Button>
          }
        />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button onClick={onNext} disabled={topLevelAreas.length === 0}>
          These are my areas →
        </Button>
        {topLevelAreas.length === 0 && (
          <span className="text-caption text-muted-foreground">Add at least one to continue.</span>
        )}
      </div>
    </div>
  );
}
