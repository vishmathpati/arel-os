/**
 * StepPlaceholder — Phase 2 territory (Finance gate, Recipes gate, AI/.env
 * gate, Helpers). This phase auto-skips through these steps so the flow still
 * reaches Done, but renders a visible marker (never silently invisible) in
 * case a step is reached directly (e.g. resuming a state file that names one
 * as `current_step`). Phase 2 replaces each with its real gate/step screen —
 * see the insertion points documented in welcome-page.tsx.
 */

import { Button } from "@/shared/components/ui/button";

const LABELS: Record<string, string> = {
  "gate-finance": "Finance setup",
  "gate-recipes": "Recipes setup",
  "gate-ai": "AI key setup",
  helpers: "Optional helpers",
};

export function StepPlaceholder({
  stepId,
  onNext,
}: {
  stepId: string;
  onNext: () => void;
}) {
  const label = LABELS[stepId] ?? stepId;
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-heading font-semibold">{label} is coming soon.</h1>
        <p className="text-body text-muted-foreground">
          This part of setup isn't built yet — it'll show up in a future update. Nothing to do here;
          we'll skip ahead.
        </p>
      </div>
      <Button onClick={onNext}>Continue →</Button>
    </div>
  );
}
