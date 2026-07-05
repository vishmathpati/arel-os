/**
 * RecipesPage — the Engine control center, index view. A single table of every
 * automation the Engine can run: its live system status (are its tools working?),
 * its schedule, when it last ran, and an on/off switch. Click a row to open that
 * recipe's own page. Recipes are authored in Claude chat, so there's no create
 * affordance here. Global default/fallback model controls sit above the table.
 *
 * Design: flagship block-page shell (DESIGN.md) — PageHeader + width-capped body,
 * one bordered shadcn Table, all four states (loading / empty / error / populated).
 */

import { PageHeader } from "@/app/page-header";
import { formatRelTime, formatSchedule } from "@/app/recipes/recipe-format";
import { useAllHealth } from "@/app/recipes/use-health";
import { useRecipes } from "@/app/recipes/use-recipes";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Separator } from "@/shared/components/ui/separator";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Switch } from "@/shared/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import type { EngineConfig, HealthStatus, RecipeListItem } from "@/shared/lib/engine/client";
import { ChevronRight, Workflow } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function RecipesPage() {
  const {
    recipes,
    config,
    loading,
    error,
    reload,
    setDefaultModel,
    setFallbackModel,
    setRecipeEnabled,
  } = useRecipes();
  const health = useAllHealth();

  return (
    <div className="flex h-full flex-col">
      <PageHeader crumbs={[{ label: "Recipes" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1280px] px-6 py-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
              <Workflow className="size-5" />
            </span>
            <h1 className="text-heading font-semibold leading-tight">Recipes</h1>
          </div>

          {/* Global model controls */}
          <div className="mt-6">
            {loading ? (
              <Skeleton className="h-[5.5rem] rounded-lg" />
            ) : config ? (
              <GlobalControls
                config={config}
                onDefaultChange={setDefaultModel}
                onFallbackChange={setFallbackModel}
              />
            ) : null}
          </div>

          {/* Recipe table */}
          <div className="mt-8">
            {loading ? (
              <TableSkeleton />
            ) : error ? (
              <Alert variant="destructive">
                <AlertTitle>Couldn't load recipes</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
                <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={reload}>
                  Retry
                </Button>
              </Alert>
            ) : recipes.length === 0 ? (
              <EmptyRecipes />
            ) : (
              <div className="overflow-hidden rounded-lg border border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-4">Recipe</TableHead>
                      <TableHead className="w-44">Status</TableHead>
                      <TableHead className="w-48">Schedule</TableHead>
                      <TableHead className="w-32">Last run</TableHead>
                      <TableHead className="w-28 text-right pr-4">Enabled</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipes.map((recipe) => (
                      <RecipeRow
                        key={recipe.name}
                        recipe={recipe}
                        overall={health[recipe.name]?.overall}
                        scheduleLabel={formatSchedule(recipe.schedule ?? recipe.trigger)}
                        onToggle={(enabled) => setRecipeEnabled(recipe.name, enabled)}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Recipe row ──────────────────────────────────────────────────────────────────

function RecipeRow({
  recipe,
  overall,
  scheduleLabel,
  onToggle,
}: {
  recipe: RecipeListItem;
  overall: HealthStatus | undefined;
  scheduleLabel: string;
  onToggle: (enabled: boolean) => void;
}) {
  const navigate = useNavigate();
  return (
    <TableRow
      className="cursor-pointer"
      onClick={() => navigate(`/recipes/${encodeURIComponent(recipe.name)}`)}
    >
      <TableCell className="pl-4">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{recipe.name}</span>
          <ChevronRight className="size-3.5 text-muted-foreground" />
        </div>
      </TableCell>
      <TableCell>
        <HealthPill overall={overall} enabled={recipe.enabled} />
      </TableCell>
      <TableCell className="text-caption text-muted-foreground">{scheduleLabel}</TableCell>
      <TableCell>
        <LastRunCell lastRun={recipe.lastRun} />
      </TableCell>
      {/* Toggle — stop row navigation when interacting with the switch.
          A span (not a button) wrapper avoids nesting a button inside a button. */}
      <TableCell className="pr-4 text-right">
        <span
          className="inline-flex"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Switch checked={recipe.enabled} onCheckedChange={onToggle} />
        </span>
      </TableCell>
    </TableRow>
  );
}

/** Live system-status pill — rolls up the recipe's dependency health. */
function HealthPill({
  overall,
  enabled,
}: {
  overall: HealthStatus | undefined;
  enabled: boolean;
}) {
  if (!enabled) {
    return <span className="text-caption text-muted-foreground">Off</span>;
  }
  if (overall === undefined) {
    return (
      <span className="flex items-center gap-1.5 text-caption text-muted-foreground">
        <span className="size-2 rounded-full bg-muted-foreground/40" />
        Checking…
      </span>
    );
  }
  const map: Record<HealthStatus, { dot: string; text: string; label: string }> = {
    ok: { dot: "bg-success", text: "text-success", label: "All systems go" },
    warn: { dot: "bg-warning", text: "text-warning", label: "Needs attention" },
    down: { dot: "bg-error", text: "text-error", label: "Not working" },
  };
  const s = map[overall];
  return (
    <span className={`flex items-center gap-1.5 text-caption ${s.text}`}>
      <span className={`size-2 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function LastRunCell({ lastRun }: { lastRun: RecipeListItem["lastRun"] }) {
  if (!lastRun) return <span className="text-caption text-muted-foreground">Never</span>;
  const when = formatRelTime(lastRun.at);
  const cls = lastRun.status === "ok" ? "text-muted-foreground" : "text-error";
  return <span className={`text-caption ${cls}`}>{when}</span>;
}

// ── Global model controls ─────────────────────────────────────────────────────

function GlobalControls({
  config,
  onDefaultChange,
  onFallbackChange,
}: {
  config: EngineConfig;
  onDefaultChange: (model: string) => void;
  onFallbackChange: (model: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-end gap-6">
        <ModelField
          id="default-model"
          label="Default model"
          value={config.defaultModel}
          models={config.models}
          onChange={onDefaultChange}
        />
        <Separator orientation="vertical" className="hidden h-9 sm:block" />
        <ModelField
          id="fallback-model"
          label="Fallback model"
          value={config.fallbackModel}
          models={config.models}
          onChange={onFallbackChange}
        />
      </div>
      <p className="mt-3 text-caption text-muted-foreground">
        The fallback runs only when the default model errors. A recipe's own model overrides both.
      </p>
    </div>
  );
}

function ModelField({
  id,
  label,
  value,
  models,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  models: string[];
  onChange: (model: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-caption text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-56">
          <SelectValue placeholder="Choose a model" />
        </SelectTrigger>
        <SelectContent>
          {models.map((model) => (
            <SelectItem key={model} value={model}>
              {model}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ── Loading + empty states ────────────────────────────────────────────────────

function EmptyRecipes() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border border-dashed bg-card/40 px-6 py-12 text-center">
      <Workflow className="size-5 text-muted-foreground" />
      <h2 className="mt-3 text-subheading font-medium">No recipes yet</h2>
      <p className="mt-1 max-w-sm text-body text-muted-foreground">
        Recipes are created in Claude chat. Ask Claude to set up an automation and it will appear
        here.
      </p>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-col divide-y divide-border">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="ml-auto h-4 w-28" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-10 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
