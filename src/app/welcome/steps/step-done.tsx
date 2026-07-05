/**
 * Step 10 — Done (spec §3 Step 10). Dynamic summary built from the artifacts
 * recorded on each step (never hard-coded) plus the gate answers. Accepted
 * gates (Phase 2: finance / recipes / ai) render their real outcome counts;
 * declined gates show as "Not set up yet" with a deep link. Primary sets
 * `status: done` and returns to the app.
 */

import { Button } from "@/shared/components/ui/button";
import type { OnboardingArtifacts, OnboardingGates } from "@/shared/lib/onboarding/client";
import { Check, Circle } from "lucide-react";
import { Link } from "react-router-dom";

function formatDeadline(d?: string): string | null {
  if (!d) return null;
  const date = new Date(`${d}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? d
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function StepDone({
  systemName,
  artifacts,
  gates,
  onFinish,
}: {
  systemName: string;
  artifacts: OnboardingArtifacts;
  gates: OnboardingGates;
  onFinish: () => void;
}) {
  const deadline = formatDeadline(artifacts.questDeadline);

  const checklist: string[] = [];
  if (artifacts.questTitle) {
    checklist.push(`A quest: ${artifacts.questTitle}${deadline ? ` (due ${deadline})` : ""}`);
  }
  if (artifacts.projectTitle) checklist.push(`A project under it: ${artifacts.projectTitle}`);
  if (artifacts.taskCount) {
    checklist.push(`${artifacts.taskCount} task${artifacts.taskCount === 1 ? "" : "s"} added`);
  }
  if (artifacts.habitTitle) checklist.push(`A habit: ${artifacts.habitTitle}`);
  if (artifacts.capturedInbox) checklist.push("Something waiting in your Inbox");
  if (artifacts.manifestoStarted) checklist.push("Today's Morning Manifesto started");
  if (gates.finance === "yes") {
    const accounts = artifacts.financeAccountCount ?? 0;
    const subs = artifacts.financeSubCount ?? 0;
    checklist.push(
      `Finance: ${accounts} account${accounts === 1 ? "" : "s"}, ${subs} subscription${subs === 1 ? "" : "s"}`,
    );
  }
  if (gates.recipes === "yes") {
    const n = artifacts.recipesEnabledCount ?? 0;
    checklist.push(`${n} recipe${n === 1 ? "" : "s"} enabled`);
  }
  if (gates.ai === "yes") {
    checklist.push(artifacts.aiKeyValidated ? "AI key connected and verified" : "AI key saved");
  }

  const declined: { label: string; to: string; cta: string }[] = [];
  if (gates.finance !== "yes")
    declined.push({ label: "Finance", to: "/databases", cta: "Turn on" });
  if (gates.recipes !== "yes") declined.push({ label: "Recipes", to: "/recipes", cta: "Turn on" });
  if (gates.ai !== "yes") declined.push({ label: "AI key", to: "/guide", cta: "Set up later" });

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-heading font-semibold">Your system is live, {systemName}.</h1>
      </div>

      {checklist.length > 0 && (
        <ul className="space-y-1.5">
          {checklist.map((line) => (
            <li key={line} className="flex items-center gap-2 text-body">
              <Check className="size-4 shrink-0 text-success" />
              {line}
            </li>
          ))}
        </ul>
      )}

      {declined.length > 0 && (
        <ul className="space-y-1.5">
          {declined.map((d) => (
            <li key={d.label} className="flex items-center gap-2 text-body text-muted-foreground">
              <Circle className="size-4 shrink-0" />
              {d.label} — not set up yet ·{" "}
              <Link to={d.to} className="underline underline-offset-2">
                {d.cta}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="text-body text-muted-foreground">
        Everything you just made is a plain file on your Mac, under your vault folder — quests in{" "}
        <code className="text-caption">quests/</code>, tasks in{" "}
        <code className="text-caption">tasks/</code>, money in{" "}
        <code className="text-caption">databases/</code>. You own it; no cloud required.
      </p>

      <p className="text-body text-muted-foreground">
        Lost about where something goes? The{" "}
        <Link to="/guide" className="underline underline-offset-2">
          Guide
        </Link>{" "}
        walks you through it anytime. Re-run this setup from Settings.
      </p>

      <Button onClick={onFinish}>Enter {systemName} →</Button>
    </div>
  );
}
