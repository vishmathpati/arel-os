/**
 * useOnboarding — loads onboarding progress once and exposes the mutations the
 * wizard shell + steps need. Every mutation writes through immediately (the
 * local vault server is sub-ms) so a crash/quit resumes at `currentStep` with
 * `completedSteps`/`artifacts` intact. Mirrors the useAreas/useQuests shape.
 */

import {
  type OnboardingArtifacts,
  type OnboardingState,
  type StepId,
  markStepComplete,
  nextStepAfter,
  readOnboarding,
  writeOnboarding,
} from "@/shared/lib/onboarding/client";
import { useCallback, useEffect, useState } from "react";

export interface UseOnboarding {
  state: OnboardingState | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** Mark `step` complete (optionally as skipped, optionally recording
   * artifacts) and advance to `next` (defaults to the canonical next step). */
  advance: (
    step: StepId,
    opts?: { next?: StepId; skipped?: boolean; artifacts?: Partial<OnboardingArtifacts> },
  ) => Promise<void>;
  /** Jump to an arbitrary step without marking anything complete (e.g. the
   * Morning Manifesto deep-link + "Back to setup" round trip). */
  goTo: (step: StepId) => Promise<void>;
  setGate: (name: "finance" | "recipes" | "ai" | "helpers", value: "yes" | "no") => Promise<void>;
  skipAll: () => Promise<void>;
  finish: () => Promise<void>;
  /** Relaunch a finished/skipped wizard from Settings/Guide — non-destructive,
   * preserves any data already created. */
  relaunch: () => Promise<void>;
}

const errMessage = (err: unknown): string =>
  err instanceof Error ? err.message : "Something went wrong";

export function useOnboarding(): UseOnboarding {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    readOnboarding()
      .then(setState)
      .catch((err) => setError(errMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => reload(), [reload]);

  const advance = useCallback(
    async (
      step: StepId,
      opts: { next?: StepId; skipped?: boolean; artifacts?: Partial<OnboardingArtifacts> } = {},
    ) => {
      const current = state ?? (await readOnboarding());
      const next = opts.next ?? nextStepAfter(step);
      const patch = markStepComplete(current, step, next, {
        skipped: opts.skipped,
        artifacts: opts.artifacts,
      });
      const updated = await writeOnboarding(patch);
      setState(updated);
    },
    [state],
  );

  const goTo = useCallback(async (step: StepId) => {
    const updated = await writeOnboarding({ status: "in-progress", currentStep: step });
    setState(updated);
  }, []);

  const setGate = useCallback(
    async (name: "finance" | "recipes" | "ai" | "helpers", value: "yes" | "no") => {
      const current = state ?? (await readOnboarding());
      const updated = await writeOnboarding({
        gates: { ...current.gates, [name]: value },
      });
      setState(updated);
    },
    [state],
  );

  const skipAll = useCallback(async () => {
    const updated = await writeOnboarding({ status: "skipped" });
    setState(updated);
  }, []);

  const finish = useCallback(async () => {
    const updated = await writeOnboarding({ status: "done", currentStep: "done" });
    setState(updated);
  }, []);

  const relaunch = useCallback(async () => {
    const updated = await writeOnboarding({ status: "in-progress", currentStep: "welcome" });
    setState(updated);
  }, []);

  return { state, loading, error, reload, advance, goTo, setGate, skipAll, finish, relaunch };
}
