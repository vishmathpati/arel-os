/**
 * useQuests — loads all quests for the list page plus create/update. Confirmed
 * writes update local state; failures toast. The Weekly Review (Ch13) drives the
 * mutation surface: milestone toggles (Reflect), status/roll (Maintain deadline
 * review), and focus toggles (Plan).
 */

import {
  type CreateQuestInput,
  type Quest,
  createQuest,
  listQuests,
  rollOverQuest,
  setQuestStatus,
  toggleMilestone,
  updateQuest,
} from "@/shared/lib/quest-data";
import type { QuestFrontmatter, QuestStatus } from "@/shared/lib/vault/schemas";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export interface UseQuests {
  quests: Quest[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  create: (input: CreateQuestInput) => Promise<Quest | null>;
  patch: (quest: Quest, patch: Partial<QuestFrontmatter>) => Promise<void>;
  /** Set status; ending a quest demotes its projects. Returns the demoted count. */
  setStatus: (quest: Quest, status: QuestStatus) => Promise<number>;
  /** Roll a quest to a new deadline (re-activates it). */
  roll: (quest: Quest, newDeadline: string) => Promise<void>;
  toggleMilestoneAt: (quest: Quest, index: number) => Promise<void>;
}

const errMessage = (err: unknown): string =>
  err instanceof Error ? err.message : "Something went wrong";

export function useQuests(): UseQuests {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    listQuests()
      .then(setQuests)
      .catch((err) => setError(errMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => reload(), [reload]);

  const replace = useCallback((updated: Quest) => {
    setQuests((prev) => prev.map((q) => (q.path === updated.path ? updated : q)));
  }, []);

  const create = useCallback(async (input: CreateQuestInput) => {
    try {
      const quest = await createQuest(input);
      setQuests((prev) => [...prev, quest]);
      toast.success("Quest created");
      return quest;
    } catch (err) {
      toast.error(`Couldn't create quest: ${errMessage(err)}`);
      return null;
    }
  }, []);

  const patch = useCallback(
    async (quest: Quest, p: Partial<QuestFrontmatter>) => {
      try {
        replace(await updateQuest(quest, p));
      } catch (err) {
        toast.error(`Couldn't save: ${errMessage(err)}`);
      }
    },
    [replace],
  );

  const setStatus = useCallback(
    async (quest: Quest, status: QuestStatus) => {
      try {
        const { quest: updated, demoted } = await setQuestStatus(quest, status);
        replace(updated);
        return demoted;
      } catch (err) {
        toast.error(`Couldn't update: ${errMessage(err)}`);
        return 0;
      }
    },
    [replace],
  );

  const roll = useCallback(
    async (quest: Quest, newDeadline: string) => {
      try {
        replace(await rollOverQuest(quest, newDeadline));
      } catch (err) {
        toast.error(`Couldn't roll over: ${errMessage(err)}`);
      }
    },
    [replace],
  );

  const toggleMilestoneAt = useCallback(
    async (quest: Quest, index: number) => {
      try {
        replace(await toggleMilestone(quest, index));
      } catch (err) {
        toast.error(`Couldn't update milestone: ${errMessage(err)}`);
      }
    },
    [replace],
  );

  return { quests, loading, error, reload, create, patch, setStatus, roll, toggleMilestoneAt };
}
