/**
 * WelcomePage — the onboarding wizard route (`/welcome`). Step router keyed
 * off `useOnboarding().state.currentStep`; renders the WizardShell chrome
 * around whichever step component is current. Resumable (jumps straight to
 * `currentStep` on load), skippable per-step ("Skip this" marks the step
 * complete with no data created and advances), and exitable at any time
 * ("Exit setup" sets status: skipped and returns to the app).
 *
 * PHASE 1 (this build): welcome, areas, quest, project, tasks, habit, inbox,
 * manifesto, done are real. gate-finance / gate-recipes / gate-ai / helpers
 * render `StepPlaceholder` and auto-advance — see PLACEHOLDER_STEPS in
 * onboarding/client.ts.
 *
 * PHASE 2 insertion points (exact, for the next agent):
 *   - Replace the `isPlaceholderStep(step)` branch below with real step
 *     components for "gate-finance", "gate-recipes", "gate-ai", "helpers".
 *     Each gate step should call `setGate(name, "yes" | "no")` before
 *     `advance(step, { artifacts })`, mirroring how StepAreas/StepQuest call
 *     `advance` today. No change to STEP_ORDER, the persistence shape, or the
 *     shell is required — only new files under `src/app/welcome/steps/` and
 *     new cases in the switch below.
 *   - `VISIBLE_STEPS` (the dot count) should grow from 8 to include the real
 *     gate/helpers screens once they're not pure pass-throughs.
 */

import { StepAreas } from "@/app/welcome/steps/step-areas";
import { StepDone } from "@/app/welcome/steps/step-done";
import { StepHabit } from "@/app/welcome/steps/step-habit";
import { StepInbox } from "@/app/welcome/steps/step-inbox";
import { StepManifesto } from "@/app/welcome/steps/step-manifesto";
import { StepPlaceholder } from "@/app/welcome/steps/step-placeholder";
import { StepProject } from "@/app/welcome/steps/step-project";
import { StepQuest } from "@/app/welcome/steps/step-quest";
import { StepTasks } from "@/app/welcome/steps/step-tasks";
import { StepWelcome } from "@/app/welcome/steps/step-welcome";
import { useOnboarding } from "@/app/welcome/use-onboarding";
import { WizardShell } from "@/app/welcome/wizard-shell";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { usePublicConfig } from "@/shared/lib/config/use-config";
import { type StepId, isPlaceholderStep } from "@/shared/lib/onboarding/client";
import type { Project } from "@/shared/lib/project-data";
import type { Quest } from "@/shared/lib/quest-data";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

/** Steps shown as progress dots this phase (gates/helpers excluded — they're
 * pure pass-throughs until Phase 2 lands real screens). */
const VISIBLE_STEPS: StepId[] = [
  "welcome",
  "areas",
  "quest",
  "project",
  "tasks",
  "habit",
  "inbox",
  "manifesto",
];

export function WelcomePage() {
  const { displayName } = usePublicConfig();
  const { state, loading, advance, skipAll, finish } = useOnboarding();
  const navigate = useNavigate();

  // In-flight artifacts carried between steps within this session (also
  // persisted to onboarding.md artifacts on each advance, so a resume after a
  // quit still has them for Done / the project→quest link).
  const [quest, setQuest] = useState<Quest | null>(null);
  const [project, setProject] = useState<Project | null>(null);

  if (loading || !state) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Skeleton className="h-64 w-full max-w-xl" />
      </div>
    );
  }

  const step = state.currentStep;
  const dotIndex = VISIBLE_STEPS.indexOf(step);

  const exitSetup = async () => {
    await skipAll();
    navigate("/");
  };

  const skipCurrent = async () => {
    await advance(step, { skipped: true });
  };

  const canSkip = step !== "welcome" && step !== "done" && !isPlaceholderStep(step);

  const renderStep = () => {
    if (isPlaceholderStep(step)) {
      return <StepPlaceholder stepId={step} onNext={() => advance(step, { skipped: true })} />;
    }

    switch (step) {
      case "welcome":
        return (
          <StepWelcome
            systemName={displayName}
            resuming={state.completedSteps.length > 0}
            onNext={() => advance("welcome")}
            onSkipAll={exitSetup}
          />
        );

      case "areas":
        return <StepAreas onNext={() => advance("areas")} />;

      case "quest":
        return (
          <StepQuest
            onNext={(q) => {
              setQuest(q);
              advance("quest", {
                artifacts: q
                  ? { questSlug: q.slug, questTitle: q.title, questDeadline: q.deadline }
                  : undefined,
              });
            }}
          />
        );

      case "project":
        return (
          <StepProject
            quest={quest}
            onNext={(p) => {
              setProject(p);
              advance("project", {
                artifacts: p ? { projectSlug: p.slug, projectTitle: p.title } : undefined,
              });
            }}
          />
        );

      case "tasks":
        return (
          <StepTasks
            quest={quest}
            project={project}
            onNext={(count) => advance("tasks", { artifacts: { taskCount: count } })}
          />
        );

      case "habit":
        return (
          <StepHabit
            onNext={(h) =>
              advance("habit", {
                artifacts: h ? { habitSlug: h.slug, habitTitle: h.title } : undefined,
              })
            }
          />
        );

      case "inbox":
        return (
          <StepInbox
            onNext={(captured) => advance("inbox", { artifacts: { capturedInbox: captured } })}
          />
        );

      case "manifesto":
        return (
          <StepManifesto
            onNext={(started) => advance("manifesto", { artifacts: { manifestoStarted: started } })}
          />
        );

      case "done":
        return (
          <StepDone
            systemName={displayName}
            artifacts={state.artifacts}
            gates={state.gates}
            onFinish={async () => {
              await finish();
              navigate("/");
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <WizardShell
      systemName={displayName}
      stepIndex={dotIndex === -1 ? VISIBLE_STEPS.length - 1 : dotIndex}
      stepCount={VISIBLE_STEPS.length}
      onSkipStep={canSkip ? skipCurrent : undefined}
      onExit={exitSetup}
    >
      {renderStep()}
    </WizardShell>
  );
}
