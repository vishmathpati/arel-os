/**
 * Step 4a — Project under the quest (real creation, spec §3 Step 4a). Embeds
 * `NewProjectDialog` pre-filled to the quest's area (if a quest was created;
 * standalone otherwise — teaching steps never hard-depend on earlier ones per
 * spec §2.3). After create, patches `quest` onto the project with the exact
 * call `project-detail-page.tsx` uses (`patch({ quest: toWikilink(slug) })`).
 */

import { NewProjectDialog } from "@/app/projects/new-project-dialog";
import { useProjects } from "@/app/projects/use-projects";
import { Button } from "@/shared/components/ui/button";
import type { Project } from "@/shared/lib/project-data";
import type { Quest } from "@/shared/lib/quest-data";
import { toWikilink, wikiTarget } from "@/shared/lib/vault/frontmatter";
import { useState } from "react";

export function StepProject({
  quest,
  onNext,
}: {
  quest: Quest | null;
  onNext: (project: Project | null) => void;
}) {
  const { create, patch } = useProjects();
  const [created, setCreated] = useState<Project | null>(null);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-heading font-semibold">Break it into a Project.</h1>
        <p className="text-body text-muted-foreground">
          A Project is multi-step work with a checklist — the concrete pieces that move your Quest
          forward. Make the first one now. You can add more later.
        </p>
      </div>

      {created ? (
        <p className="rounded-md border border-border bg-muted/40 px-4 py-3 text-body">
          {quest
            ? `'${created.title}' now lives under your quest '${quest.title}'.`
            : `'${created.title}' is live.`}
        </p>
      ) : (
        <div>
          <NewProjectDialog
            defaultArea={quest?.area ? wikiTarget(quest.area) : undefined}
            onCreate={async (input) => {
              const project = await create(input);
              if (project && quest) {
                await patch(project, { quest: toWikilink(quest.slug) });
              }
              if (project) setCreated(project);
              return project;
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
