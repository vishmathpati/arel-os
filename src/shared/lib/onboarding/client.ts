/**
 * Onboarding persistence — reads/writes `system/onboarding.md`, the frontmatter
 * state machine that drives the first-run wizard (see the onboarding spec).
 * Thin wrappers over the existing atomic vault I/O (`vault/client.ts`); no new
 * storage mechanism, mirrors `server/engine/config.ts`'s "absent file → seeded
 * defaults" pattern but on the browser-only client since onboarding state is
 * pure UI/user-journey state, never read by the Engine.
 *
 * Step order: welcome → areas → quest → project → tasks → habit → inbox →
 * manifesto → gate-finance → gate-recipes → gate-ai → helpers → done. As of
 * Phase 2, every step (including the three gates + helpers) has a real
 * screen — see `welcome-page.tsx`. `PLACEHOLDER_STEPS`/`isPlaceholderStep`
 * are kept (now always empty/false) purely so a stale persisted
 * `current_step` from a Phase-1 vault never resolves to an unknown branch.
 */

import { readDoc, writeDoc } from "@/shared/lib/vault/client";
import { onboardingPath } from "@/shared/lib/vault/paths";
import type { OnboardingFrontmatter, VaultDoc } from "@/shared/lib/vault/schemas";

export type OnboardingStatus = "not-started" | "in-progress" | "done" | "skipped";

/** Every step id in flow order, including Phase-2 gates/helpers (built as
 * placeholders this phase — see `isPlaceholderStep`). */
export const STEP_ORDER = [
  "welcome",
  "areas",
  "quest",
  "project",
  "tasks",
  "habit",
  "inbox",
  "manifesto",
  "gate-finance",
  "gate-recipes",
  "gate-ai",
  "helpers",
  "done",
] as const;

export type StepId = (typeof STEP_ORDER)[number];

/** No step is a placeholder as of Phase 2 — every step has a real screen. Kept
 * as an (empty) set + predicate rather than deleted so `welcome-page.tsx`'s
 * defensive `isPlaceholderStep` branch (guarding a stale persisted
 * `current_step`) still compiles without a dead import. */
export const PLACEHOLDER_STEPS: ReadonlySet<StepId> = new Set([]);

export function isPlaceholderStep(step: StepId): boolean {
  return PLACEHOLDER_STEPS.has(step);
}

export type GateAnswer = "pending" | "yes" | "no";

export interface OnboardingGates {
  finance: GateAnswer;
  recipes: GateAnswer;
  ai: GateAnswer;
  helpers: GateAnswer;
}

/** Free-form breadcrumbs the steps record about what the user made, so Done
 * (and resume) can reference real data without re-reading every primitive. */
export interface OnboardingArtifacts {
  questSlug?: string;
  questTitle?: string;
  questDeadline?: string;
  projectSlug?: string;
  projectTitle?: string;
  taskCount?: number;
  habitSlug?: string;
  habitTitle?: string;
  capturedInbox?: boolean;
  manifestoStarted?: boolean;
  financeAccountCount?: number;
  financeSubCount?: number;
  recipesEnabledCount?: number;
  aiKeyValidated?: boolean;
}

export interface OnboardingState {
  status: OnboardingStatus;
  currentStep: StepId;
  completedSteps: StepId[];
  /** Step ids completed via "Skip this" rather than real creation. */
  skippedSteps: StepId[];
  gates: OnboardingGates;
  artifacts: OnboardingArtifacts;
  started?: string;
  updated?: string;
}

const DEFAULT_GATES: OnboardingGates = {
  finance: "pending",
  recipes: "pending",
  ai: "pending",
  helpers: "pending",
};

function seededState(): OnboardingState {
  return {
    status: "not-started",
    currentStep: "welcome",
    completedSteps: [],
    skippedSteps: [],
    gates: { ...DEFAULT_GATES },
    artifacts: {},
  };
}

function isStepId(v: unknown): v is StepId {
  return typeof v === "string" && (STEP_ORDER as readonly string[]).includes(v);
}

function isGateAnswer(v: unknown): v is GateAnswer {
  return v === "pending" || v === "yes" || v === "no";
}

function coerceGates(fm: Partial<OnboardingFrontmatter>): OnboardingGates {
  const raw = fm.gates;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...DEFAULT_GATES };
  const g = raw as Record<string, unknown>;
  return {
    finance: isGateAnswer(g.finance) ? g.finance : "pending",
    recipes: isGateAnswer(g.recipes) ? g.recipes : "pending",
    ai: isGateAnswer(g.ai) ? g.ai : "pending",
    helpers: isGateAnswer(g.helpers) ? g.helpers : "pending",
  };
}

function coerceArtifacts(fm: Partial<OnboardingFrontmatter>): OnboardingArtifacts {
  const raw = fm.artifacts;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const a = raw as Record<string, unknown>;
  const out: OnboardingArtifacts = {};
  if (typeof a.questSlug === "string") out.questSlug = a.questSlug;
  if (typeof a.questTitle === "string") out.questTitle = a.questTitle;
  if (typeof a.questDeadline === "string") out.questDeadline = a.questDeadline;
  if (typeof a.projectSlug === "string") out.projectSlug = a.projectSlug;
  if (typeof a.projectTitle === "string") out.projectTitle = a.projectTitle;
  if (typeof a.taskCount === "number") out.taskCount = a.taskCount;
  if (typeof a.habitSlug === "string") out.habitSlug = a.habitSlug;
  if (typeof a.habitTitle === "string") out.habitTitle = a.habitTitle;
  if (typeof a.capturedInbox === "boolean") out.capturedInbox = a.capturedInbox;
  if (typeof a.manifestoStarted === "boolean") out.manifestoStarted = a.manifestoStarted;
  if (typeof a.financeAccountCount === "number") out.financeAccountCount = a.financeAccountCount;
  if (typeof a.financeSubCount === "number") out.financeSubCount = a.financeSubCount;
  if (typeof a.recipesEnabledCount === "number") out.recipesEnabledCount = a.recipesEnabledCount;
  if (typeof a.aiKeyValidated === "boolean") out.aiKeyValidated = a.aiKeyValidated;
  return out;
}

function coerce(fm: Partial<OnboardingFrontmatter>): OnboardingState {
  const base = seededState();
  const status: OnboardingStatus =
    fm.status === "not-started" ||
    fm.status === "in-progress" ||
    fm.status === "done" ||
    fm.status === "skipped"
      ? fm.status
      : base.status;

  const currentStep = isStepId(fm.current_step) ? fm.current_step : base.currentStep;
  const completedSteps = Array.isArray(fm.completed_steps)
    ? fm.completed_steps.filter(isStepId)
    : base.completedSteps;
  const skippedSteps = Array.isArray(fm.skipped_steps)
    ? fm.skipped_steps.filter(isStepId)
    : base.skippedSteps;

  return {
    status,
    currentStep,
    completedSteps,
    skippedSteps,
    gates: coerceGates(fm),
    artifacts: coerceArtifacts(fm),
    started: typeof fm.started === "string" ? fm.started : undefined,
    updated: typeof fm.updated === "string" ? fm.updated : undefined,
  };
}

function toFrontmatter(state: OnboardingState): Record<string, unknown> {
  return {
    type: "system",
    status: state.status,
    current_step: state.currentStep,
    completed_steps: state.completedSteps,
    skipped_steps: state.skippedSteps,
    gates: state.gates,
    artifacts: state.artifacts,
    started: state.started ?? new Date().toISOString(),
    updated: new Date().toISOString(),
  };
}

const BODY_COMMENT = "<!-- Arel OS onboarding progress. Safe to delete to replay the wizard. -->";

/**
 * Read onboarding progress. Returns the seeded not-started state (without
 * writing) when `system/onboarding.md` is absent, so a fresh vault Just Works
 * — mirrors `server/engine/config.ts::readEngineConfig`.
 */
export async function readOnboarding(): Promise<OnboardingState> {
  try {
    const doc = (await readDoc(onboardingPath())) as VaultDoc<OnboardingFrontmatter>;
    return coerce(doc.frontmatter);
  } catch {
    return seededState();
  }
}

/**
 * Merge a partial state into the current onboarding state and persist it
 * atomically. Called on every step completion and every gate answer so a
 * crash/quit resumes at `currentStep` with prior progress intact.
 */
export async function writeOnboarding(patch: Partial<OnboardingState>): Promise<OnboardingState> {
  const current = await readOnboarding();
  const merged: OnboardingState = {
    status: patch.status ?? current.status,
    currentStep: patch.currentStep ?? current.currentStep,
    completedSteps: patch.completedSteps ?? current.completedSteps,
    skippedSteps: patch.skippedSteps ?? current.skippedSteps,
    gates: patch.gates ? { ...current.gates, ...patch.gates } : current.gates,
    artifacts: patch.artifacts ? { ...current.artifacts, ...patch.artifacts } : current.artifacts,
    started: current.started,
    updated: undefined,
  };
  const res = await writeDoc(onboardingPath(), toFrontmatter(merged), BODY_COMMENT);
  return coerce(res.frontmatter as Partial<OnboardingFrontmatter>);
}

/** Append a step id to `completedSteps` (idempotent) and advance
 * `currentStep` to `next`, optionally recording it as skipped and/or merging
 * artifact data collected on that step. */
export function markStepComplete(
  state: OnboardingState,
  step: StepId,
  next: StepId,
  opts: { skipped?: boolean; artifacts?: Partial<OnboardingArtifacts> } = {},
): Partial<OnboardingState> {
  const completedSteps = state.completedSteps.includes(step)
    ? state.completedSteps
    : [...state.completedSteps, step];
  const skippedSteps =
    opts.skipped && !state.skippedSteps.includes(step)
      ? [...state.skippedSteps, step]
      : state.skippedSteps;

  return {
    status: "in-progress",
    currentStep: next,
    completedSteps,
    skippedSteps,
    ...(opts.artifacts ? { artifacts: { ...state.artifacts, ...opts.artifacts } } : {}),
  };
}

/** Index of a step in the canonical order; -1 if unknown. */
export function stepIndex(step: StepId): number {
  return STEP_ORDER.indexOf(step);
}

/** The next step after `step` in the canonical order, or "done" at the end. */
export function nextStepAfter(step: StepId): StepId {
  const i = stepIndex(step);
  if (i === -1 || i >= STEP_ORDER.length - 1) return "done";
  return STEP_ORDER[i + 1];
}
