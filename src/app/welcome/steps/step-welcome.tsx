/**
 * Step 1 — Welcome (spec §3, Step 1). Greets with the installer's displayName
 * (usePublicConfig — no vault system_name field per the task override; the
 * installer's config.json is the source of truth for the name, and it always
 * exists by the time the app boots). Primary advances; secondary skips the
 * whole wizard (status: skipped).
 */

import { Button } from "@/shared/components/ui/button";

export function StepWelcome({
  systemName,
  resuming,
  onNext,
  onSkipAll,
}: {
  systemName: string;
  resuming: boolean;
  onNext: () => void;
  onSkipAll: () => void;
}) {
  return (
    <div className="space-y-6">
      {resuming && (
        <p className="rounded-md border border-border bg-muted/40 px-4 py-2 text-caption text-muted-foreground">
          Welcome back — let's pick up where you left off.
        </p>
      )}

      <div className="space-y-3">
        <h1 className="text-heading font-semibold">Welcome to {systemName}.</h1>
        <p className="text-body text-muted-foreground">
          This is your whole life in one place — goals, projects, tasks, notes, and money, all
          stored as plain files on your own machine. Let's set it up together, doing the real thing
          as we go. It takes about ten minutes, and you can stop anytime.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={onNext}>Let's go →</Button>
        <Button variant="ghost" className="text-muted-foreground" onClick={onSkipAll}>
          Skip setup, I'll explore on my own
        </Button>
      </div>
    </div>
  );
}
