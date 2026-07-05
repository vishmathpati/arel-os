/**
 * Step 3 — Quest (real creation, spec §3 Step 3). Embeds the real
 * `NewQuestDialog` behind its own trigger button (dialogs in this codebase
 * always own their `open` state — see new-quest-dialog.tsx — so the wizard
 * renders the dialog's normal trigger inline rather than forking a controlled
 * variant; clicking it opens the exact same form the Quests page uses).
 * `onCreate` resolves → wizard shows a confirm line → advances.
 */

import { NewQuestDialog } from "@/app/quests/new-quest-dialog";
import { useQuests } from "@/app/quests/use-quests";
import { Button } from "@/shared/components/ui/button";
import type { Quest } from "@/shared/lib/quest-data";
import { useState } from "react";

function formatDeadline(d: string): string {
  const date = new Date(`${d}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? d
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function StepQuest({
  onNext,
}: {
  onNext: (quest: Quest | null) => void;
}) {
  const { create } = useQuests();
  const [created, setCreated] = useState<Quest | null>(null);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-heading font-semibold">Now aim at something. That's a Quest.</h1>
        <p className="text-body text-muted-foreground">
          A Quest is a goal with a deadline — something big enough to need several projects. Pick
          one real goal you want to hit this season. We'll build the rest around it.
        </p>
      </div>

      {created ? (
        <p className="rounded-md border border-border bg-muted/40 px-4 py-3 text-body">
          Nice — '{created.title}' is live, due {formatDeadline(created.deadline)}.
        </p>
      ) : (
        <div>
          <NewQuestDialog
            onCreate={async (input) => {
              const quest = await create(input);
              if (quest) setCreated(quest);
              return quest;
            }}
          />
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button onClick={() => onNext(created)} disabled={!created}>
          Continue →
        </Button>
      </div>
    </div>
  );
}
