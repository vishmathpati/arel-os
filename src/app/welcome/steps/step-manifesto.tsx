/**
 * Step 5b — Morning Manifesto (spec §3 Step 5b). Deep-links to `/morning`
 * (with `?from=onboarding` so that page renders a "Back to setup" banner —
 * see morning-page.tsx) and lazy-creates today's note via `useDaily().start()`
 * before navigating. "Maybe later" advances without visiting `/morning`.
 */

import { useDaily } from "@/app/rituals/morning/use-daily";
import { Button } from "@/shared/components/ui/button";
import { useNavigate } from "react-router-dom";

export function StepManifesto({ onNext }: { onNext: (started: boolean) => void }) {
  const { start } = useDaily();
  const navigate = useNavigate();

  const doToday = async () => {
    await start();
    onNext(true);
    navigate("/morning?from=onboarding");
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-heading font-semibold">Start each day with a Morning Manifesto.</h1>
        <p className="text-body text-muted-foreground">
          Every morning you answer a few quick questions and see the day's tasks and quests in one
          place. It's the ritual that sets your focus. Want to do today's now?
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={doToday}>Do today's manifesto →</Button>
        <Button variant="ghost" className="text-muted-foreground" onClick={() => onNext(false)}>
          Maybe later →
        </Button>
      </div>
    </div>
  );
}
