/**
 * RecipeDetailPage — one recipe's own page (/recipes/:name). Three sections:
 *
 *   1. System checks — a live quality-control dashboard. Every dependency the
 *      recipe needs (Gmail, the AI model, currency rates, vault storage) is probed
 *      continuously and shown with a plain-English status + reason. If a tool is
 *      down the model can't do its job, so this is the first thing you see.
 *   2. Settings — model, on/off, schedule, and a Run button.
 *   3. Run history — a table of past runs in human language: what each run actually
 *      changed (names + amounts), expandable for the per-item detail.
 *
 * No file paths, no IDs, no slugs, no jargon ever reach the screen.
 */

import { DetailShell } from "@/app/detail/detail-kit";
import { GwsInstallGuide } from "@/app/recipes/gws-install-guide";
import { ProjectSyncTable } from "@/app/recipes/project-sync-table";
import {
  type Cadence,
  type ChangeGroupData,
  DAY_LABELS,
  type ScheduleForm,
  buildScheduleString,
  formatAbsTime,
  formatRelTime,
  formatSchedule,
  groupChanges,
  parseScheduleToForm,
  pluralize,
  realChanges,
  runOutcome,
} from "@/app/recipes/recipe-format";
import { useRecipeHealth } from "@/app/recipes/use-health";
import { type RunRecord, useRecipes } from "@/app/recipes/use-recipes";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
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
import type {
  DependencyHealth,
  EngineConfig,
  HealthStatus,
  RecipeListItem,
} from "@/shared/lib/engine/client";
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleX,
  Clock,
  FilePlus2,
  Loader2,
  Mail,
  Pencil,
  Play,
  RefreshCw,
  RotateCw,
  Sparkles,
  TriangleAlert,
  Wallet,
  Workflow,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

export function RecipeDetailPage() {
  const { name = "" } = useParams();
  const navigate = useNavigate();
  const {
    recipes,
    config,
    scheduleState,
    loading,
    setRecipeModel,
    setRecipeFallback,
    setRecipeSchedule,
    setRecipeEnabled,
    running,
    run,
    fetchRuns,
  } = useRecipes();

  const recipe = recipes.find((r) => r.name === name);

  // ── loading ──
  if (loading) {
    return (
      <DetailShell crumbs={[{ label: "Recipes", to: "/recipes" }, { label: name }]}>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-6 h-40 w-full rounded-lg" />
        <Skeleton className="mt-6 h-24 w-full rounded-lg" />
      </DetailShell>
    );
  }

  // ── not found ──
  if (!recipe) {
    return (
      <DetailShell crumbs={[{ label: "Recipes", to: "/recipes" }, { label: name }]}>
        <Alert>
          <AlertTitle>Recipe not found</AlertTitle>
          <AlertDescription>
            There's no recipe called "{name}".{" "}
            <button type="button" className="underline" onClick={() => navigate("/recipes")}>
              Back to recipes
            </button>
            .
          </AlertDescription>
        </Alert>
      </DetailShell>
    );
  }

  return (
    <DetailShell crumbs={[{ label: "Recipes", to: "/recipes" }, { label: recipe.name }]}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
            <Workflow className="size-5" />
          </span>
          <div>
            <h1 className="text-heading font-semibold leading-tight">{recipe.name}</h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-caption text-muted-foreground">
              <CalendarClock className="size-3" />
              {formatSchedule(recipe.schedule ?? recipe.trigger)}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          disabled={running.has(recipe.name) || !recipe.enabled}
          onClick={() => run(recipe.name)}
        >
          {running.has(recipe.name) ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Running…
            </>
          ) : (
            <>
              <Play className="size-4" />
              Run now
            </>
          )}
        </Button>
      </div>

      {/* project-sync gets a bespoke surface: every software project + per-project
          Run + Run all (D64). Other recipes skip straight to system checks. */}
      {recipe.name === "project-sync" && <ProjectSyncTable />}

      {/* 1. System checks */}
      <SystemChecks name={recipe.name} />

      {/* 2. Settings */}
      <Settings
        recipe={recipe}
        config={config}
        nextDue={scheduleState[recipe.name]?.next_due ?? null}
        lastFired={scheduleState[recipe.name]?.last_fired ?? null}
        onModelChange={(m) => setRecipeModel(recipe.name, m)}
        onFallbackChange={(m) => setRecipeFallback(recipe.name, m)}
        onScheduleChange={(s) => setRecipeSchedule(recipe.name, s)}
        onEnabledChange={(e) => setRecipeEnabled(recipe.name, e)}
      />

      {/* 3. Run history */}
      <RunHistory name={recipe.name} fetchRuns={fetchRuns} />
    </DetailShell>
  );
}

// ── 1. System checks (live quality-control dashboard) ───────────────────────────

function SystemChecks({ name }: { name: string }) {
  const { health, loading, error, recheck, rechecking } = useRecipeHealth(name);

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-subheading font-medium">System checks</h2>
          {health && <OverallBadge overall={health.overall} />}
        </div>
        <div className="flex items-center gap-3">
          {health && !loading && (
            <span className="text-caption text-muted-foreground">
              Checked {formatRelTime(health.checkedAt)}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={recheck} disabled={rechecking}>
            <RefreshCw className={`size-3.5 ${rechecking ? "animate-spin" : ""}`} />
            Re-check
          </Button>
        </div>
      </div>
      <p className="mt-1 text-caption text-muted-foreground">
        Everything this automation needs in order to run — checked continuously.
      </p>

      <div className="mt-3 overflow-hidden rounded-lg border border-border bg-card">
        {loading && !health ? (
          <div className="flex flex-col divide-y divide-border">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="size-4 rounded-full" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="ml-auto h-3 w-48" />
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="px-4 py-3 text-caption text-error">
            Couldn't run the system checks. {error}
          </p>
        ) : health ? (
          <div className="flex flex-col divide-y divide-border">
            {health.dependencies.map((dep) => (
              <div key={dep.key}>
                <DependencyRow dep={dep} />
                {dep.key === "gmail" && dep.reason === "not-installed" && <GwsInstallGuide />}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function OverallBadge({ overall }: { overall: HealthStatus }) {
  const map: Record<HealthStatus, { cls: string; label: string }> = {
    ok: { cls: "border-transparent bg-success/15 text-success", label: "All systems go" },
    warn: { cls: "border-transparent bg-warning/15 text-warning", label: "Needs attention" },
    down: { cls: "border-transparent bg-error/15 text-error", label: "Not working" },
  };
  const s = map[overall];
  return <Badge className={`font-normal ${s.cls}`}>{s.label}</Badge>;
}

const DEP_ICON: Record<string, typeof Mail> = {
  gmail: Mail,
  model: Sparkles,
  currency: Wallet,
  vault: Workflow,
};

function DependencyRow({ dep }: { dep: DependencyHealth }) {
  const DepIcon = DEP_ICON[dep.key] ?? Workflow;
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <StatusIcon status={dep.status} />
      <DepIcon className="size-4 shrink-0 text-muted-foreground" />
      <span className="w-32 shrink-0 text-body text-foreground">{dep.label}</span>
      <span className="min-w-0 flex-1 text-caption text-muted-foreground">{dep.detail}</span>
    </div>
  );
}

function StatusIcon({ status }: { status: HealthStatus }) {
  if (status === "ok") return <CheckCircle2 className="size-4 shrink-0 text-success" />;
  if (status === "warn") return <TriangleAlert className="size-4 shrink-0 text-warning" />;
  return <CircleX className="size-4 shrink-0 text-error" />;
}

// ── 2. Settings ─────────────────────────────────────────────────────────────────

const USE_GLOBAL = "__global__";

function Settings({
  recipe,
  config,
  nextDue,
  lastFired,
  onModelChange,
  onFallbackChange,
  onScheduleChange,
  onEnabledChange,
}: {
  recipe: RecipeListItem;
  config: EngineConfig | null;
  nextDue: string | null;
  lastFired: string | null;
  onModelChange: (model: string) => void;
  onFallbackChange: (model: string) => void;
  onScheduleChange: (schedule: string) => void;
  onEnabledChange: (enabled: boolean) => void;
}) {
  const models = config?.models ?? [];
  const isScheduled = formatSchedule(recipe.schedule ?? recipe.trigger) !== "Manual";
  return (
    <section className="mt-8">
      <h2 className="text-subheading font-medium">Settings</h2>
      <div className="mt-3 flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
        {/* On/off */}
        <SettingRow label="Status" hint="Turn the whole recipe on or off.">
          <div className="flex items-center gap-2">
            <Switch
              id="recipe-enabled"
              checked={recipe.enabled}
              onCheckedChange={onEnabledChange}
            />
            <span className="text-body text-foreground">
              {recipe.enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
        </SettingRow>

        {/* Model — with "use global" */}
        <SettingRow label="Model" hint="Which AI model this recipe runs on.">
          <OverrideSelect
            id="recipe-model"
            override={recipe.modelOverride}
            globalLabel={`Use global default (${config?.defaultModel ?? "—"})`}
            models={models}
            onChange={onModelChange}
          />
        </SettingRow>

        {/* Fallback — with "use global" */}
        <SettingRow label="Fallback" hint="Used only if the model above errors.">
          <OverrideSelect
            id="recipe-fallback"
            override={recipe.fallbackOverride}
            globalLabel={`Use global fallback (${config?.fallbackModel ?? "—"})`}
            models={models}
            onChange={onFallbackChange}
          />
        </SettingRow>

        {/* Schedule editor */}
        <SettingRow label="Schedule" hint="When this recipe runs on its own.">
          <ScheduleEditor recipe={recipe} onChange={onScheduleChange} />
        </SettingRow>

        {/* Next/last run */}
        {isScheduled && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3">
            <span className="flex items-center gap-1.5 text-caption text-muted-foreground">
              <CalendarClock className="size-3" />
              {nextDue ? `Next run ${formatAbsTime(nextDue)}` : "Next run not yet scheduled"}
            </span>
            {lastFired && (
              <span className="flex items-center gap-1.5 text-caption text-muted-foreground">
                <Clock className="size-3" />
                Last auto-run {formatRelTime(lastFired)}
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/** A labeled settings row: title + hint on the left, the control on the right. */
function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-body text-foreground">{label}</p>
        <p className="text-caption text-muted-foreground">{hint}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** Model/fallback picker with a leading "Use global …" option that clears the override. */
function OverrideSelect({
  id,
  override,
  globalLabel,
  models,
  onChange,
}: {
  id: string;
  override: string | undefined;
  globalLabel: string;
  models: string[];
  onChange: (value: string) => void;
}) {
  return (
    <Select
      value={override ?? USE_GLOBAL}
      onValueChange={(v) => onChange(v === USE_GLOBAL ? "" : v)}
    >
      <SelectTrigger id={id} size="sm" className="w-64">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={USE_GLOBAL}>{globalLabel}</SelectItem>
        {models.map((model) => (
          <SelectItem key={model} value={model}>
            {model}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const CADENCE_OPTIONS: { value: Cadence; label: string }[] = [
  { value: "manual", label: "Manual only" },
  { value: "daily", label: "Once a day" },
  { value: "twice", label: "Twice a day" },
  { value: "weekly", label: "Weekly" },
  { value: "interval", label: "Every few hours" },
];

/** Schedule picker: cadence + time/day inputs → builds a schedule string on Save. */
function ScheduleEditor({
  recipe,
  onChange,
}: {
  recipe: RecipeListItem;
  onChange: (schedule: string) => void;
}) {
  const current = recipe.schedule ?? recipe.trigger;
  const initial = useMemo(() => parseScheduleToForm(current), [current]);
  const [form, setForm] = useState<ScheduleForm>(initial);
  const [editing, setEditing] = useState(false);

  // Re-sync the form if the saved schedule changes (e.g. after save/reset).
  useEffect(() => setForm(initial), [initial]);

  const dirty = buildScheduleString(form) !== buildScheduleString(initial);

  function set<K extends keyof ScheduleForm>(key: K, value: ScheduleForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  function setTime(idx: 0 | 1, value: string) {
    setForm((f) => {
      const times: [string, string] = [...f.times];
      times[idx] = value;
      return { ...f, times };
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-body text-foreground">{formatSchedule(current)}</span>
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEditing(true)}>
          <Pencil className="size-3.5" />
          Edit
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Select value={form.cadence} onValueChange={(v) => set("cadence", v as Cadence)}>
          <SelectTrigger size="sm" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CADENCE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {form.cadence === "weekly" && (
          <Select value={String(form.day)} onValueChange={(v) => set("day", Number(v))}>
            <SelectTrigger size="sm" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAY_LABELS.map((d, i) => (
                <SelectItem key={d} value={String(i)}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {(form.cadence === "daily" || form.cadence === "twice" || form.cadence === "weekly") && (
          <Input
            type="time"
            value={form.times[0]}
            onChange={(e) => setTime(0, e.target.value)}
            className="h-8 w-28"
            aria-label="First time"
          />
        )}
        {form.cadence === "twice" && (
          <Input
            type="time"
            value={form.times[1]}
            onChange={(e) => setTime(1, e.target.value)}
            className="h-8 w-28"
            aria-label="Second time"
          />
        )}
        {form.cadence === "interval" && (
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              min={1}
              max={24}
              value={form.intervalHours}
              onChange={(e) => set("intervalHours", Math.max(1, Number(e.target.value)))}
              className="h-8 w-20"
              aria-label="Interval hours"
            />
            <span className="text-caption text-muted-foreground">hours</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {recipe.scheduleOverride && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-caption text-muted-foreground"
            onClick={() => {
              onChange(""); // clear override → back to the recipe's built-in schedule
              setEditing(false);
            }}
          >
            Reset to default
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={() => {
            setForm(initial);
            setEditing(false);
          }}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          className="h-7 px-3"
          disabled={!dirty}
          onClick={() => {
            onChange(buildScheduleString(form));
            setEditing(false);
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

// ── 3. Run history (human-readable table with real values) ──────────────────────

function RunHistory({
  name,
  fetchRuns,
}: {
  name: string;
  fetchRuns: (name: string, limit?: number) => Promise<RunRecord[]>;
}) {
  const [runs, setRuns] = useState<RunRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchRuns(name)
      .then((r) => {
        setRuns(r);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load history"))
      .finally(() => setLoading(false));
  }, [name, fetchRuns]);

  useEffect(() => load(), [load]);

  return (
    <section className="mt-8">
      <h2 className="text-subheading font-medium">Run history</h2>
      <div className="mt-3 overflow-hidden rounded-lg border border-border bg-card">
        {loading ? (
          <div className="flex flex-col divide-y divide-border">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="ml-auto h-4 w-64" />
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="px-4 py-3 text-caption text-error">{error}</p>
        ) : !runs || runs.length === 0 ? (
          <p className="px-4 py-6 text-center text-caption text-muted-foreground">
            This recipe hasn't run yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-40 pl-4">When</TableHead>
                <TableHead className="w-32">Outcome</TableHead>
                <TableHead>What changed</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((r) => (
                <RunRow key={r.at} run={r} />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </section>
  );
}

function RunRow({ run }: { run: RunRecord }) {
  const [open, setOpen] = useState(false);
  const outcome = runOutcome(run);
  const groups = groupChanges(realChanges(run.changes));
  // Every run is expandable — even no-change runs show their cost (time/tokens/cache).

  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => setOpen((v) => !v)}>
        <TableCell className="pl-4 text-caption text-muted-foreground">
          {formatAbsTime(run.at)}
        </TableCell>
        <TableCell>
          <OutcomeChip kind={outcome.kind} />
        </TableCell>
        <TableCell className="text-body text-foreground">{outcome.headline}</TableCell>
        <TableCell className="pr-3 text-right">
          {open ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
        </TableCell>
      </TableRow>

      {open && (
        <TableRow className="bg-muted/20 hover:bg-muted/20">
          <TableCell colSpan={4} className="px-4 py-3 pl-10">
            {groups.length > 0 && (
              <div className="flex flex-col gap-3">
                {groups.map((g) => (
                  <ChangeGroup key={`${g.kind}-${g.op}`} group={g} />
                ))}
              </div>
            )}
            <RunMeta run={run} bordered={groups.length > 0} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function ChangeGroup({ group }: { group: ChangeGroupData }) {
  const created = group.op === "created";
  const noun = group.count === 1 ? group.kind : pluralize(group.kind);
  const named = group.items.filter((it) => it.label);
  return (
    <div className="overflow-hidden rounded-md border border-border/60 bg-background/40">
      {/* Group header: action + type + count */}
      <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
        {created ? (
          <FilePlus2 className="size-3.5 shrink-0 text-success" />
        ) : (
          <RotateCw className="size-3.5 shrink-0 text-warning" />
        )}
        <span className="text-caption font-medium text-foreground">
          {created ? "Added" : "Updated"} {noun}
        </span>
        <span className="ml-auto rounded-full bg-muted px-1.5 text-caption text-muted-foreground">
          {group.count}
        </span>
      </div>
      {/* Itemized list: name … amount */}
      {named.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border/40">
          {named.map((it, i) => (
            <li
              key={`${it.label ?? "item"}-${i}`}
              className="flex items-baseline justify-between gap-4 px-3 py-1.5"
            >
              <span className="min-w-0 truncate text-body text-foreground">{it.label}</span>
              {it.amount && (
                <span className="shrink-0 text-caption text-muted-foreground">{it.amount}</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-3 py-1.5 text-caption text-muted-foreground italic">
          {group.count} {noun} (names weren't recorded for this run)
        </p>
      )}
    </div>
  );
}

function RunMeta({ run, bordered }: { run: RunRecord; bordered: boolean }) {
  const secs = `${(run.durationMs / 1000).toFixed(0)}s`;
  const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n));
  const cached = run.cachedTokens ?? 0;
  return (
    <p
      className={`text-caption text-muted-foreground ${bordered ? "mt-3 border-t border-border pt-2" : ""}`}
    >
      Took {secs} · {fmt(run.totalTokens)} tokens
      {cached > 0 && ` · ${fmt(cached)} from cache`}
    </p>
  );
}

function OutcomeChip({ kind }: { kind: ReturnType<typeof runOutcome>["kind"] }) {
  if (kind === "changed") {
    return (
      <span className="flex items-center gap-1 text-caption text-success">
        <CheckCircle2 className="size-3" />
        Synced
      </span>
    );
  }
  if (kind === "issue") {
    return (
      <span className="flex items-center gap-1 text-caption text-warning">
        <TriangleAlert className="size-3" />
        Issue
      </span>
    );
  }
  return <span className="text-caption text-muted-foreground">No changes</span>;
}
