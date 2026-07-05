/**
 * useQuest — loads one quest for the detail page and exposes its mutations
 * (status w/ demote-on-end, deadline, focus, target, milestones, notes, delete).
 * Confirmed writes update local state; failures toast.
 */

import {
  type Quest,
  addMilestone,
  deleteQuest,
  readQuest,
  removeMilestone,
  rollOverQuest,
  setQuestStatus,
  toggleMilestone,
  updateQuest,
} from "@/shared/lib/quest-data";
import type { QuestFrontmatter, QuestStatus } from "@/shared/lib/vault/schemas";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export interface UseQuest {
  quest: Quest | null;
  loading: boolean;
  notFound: boolean;
  error: string | null;
  reload: () => void;
  patch: (patch: Partial<QuestFrontmatter>) => Promise<void>;
  setStatus: (status: QuestStatus) => Promise<void>;
  rollOver: (newDeadline: string) => Promise<void>;
  toggleFocus: () => Promise<void>;
  saveNotes: (notes: string) => Promise<void>;
  addMilestoneTitle: (title: string) => Promise<void>;
  toggleMilestoneAt: (index: number) => Promise<void>;
  removeMilestoneAt: (index: number) => Promise<void>;
  remove: () => Promise<boolean>;
}

const errMessage = (err: unknown): string =>
  err instanceof Error ? err.message : "Something went wrong";

export function useQuest(slug: string): UseQuest {
  const [quest, setQuest] = useState<Quest | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    readQuest(slug)
      .then((q) => {
        if (!q) setNotFound(true);
        setQuest(q);
      })
      .catch((err) => setError(errMessage(err)))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => reload(), [reload]);

  const run = useCallback(async (fn: () => Promise<Quest>) => {
    try {
      setQuest(await fn());
    } catch (err) {
      toast.error(`Couldn't save: ${errMessage(err)}`);
    }
  }, []);

  const patch = useCallback(
    (p: Partial<QuestFrontmatter>) =>
      quest ? run(() => updateQuest(quest, p)) : Promise.resolve(),
    [quest, run],
  );

  const setStatus = useCallback(
    async (status: QuestStatus) => {
      if (!quest) return;
      try {
        const { quest: updated, demoted } = await setQuestStatus(quest, status);
        setQuest(updated);
        if (demoted > 0) {
          toast.info(`${demoted} unfinished project${demoted > 1 ? "s" : ""} re-homed to the area`);
        }
      } catch (err) {
        toast.error(`Couldn't update status: ${errMessage(err)}`);
      }
    },
    [quest],
  );

  const rollOver = useCallback(
    (newDeadline: string) =>
      quest ? run(() => rollOverQuest(quest, newDeadline)) : Promise.resolve(),
    [quest, run],
  );

  const toggleFocus = useCallback(
    () => (quest ? run(() => updateQuest(quest, { focus: !quest.focus })) : Promise.resolve()),
    [quest, run],
  );

  const saveNotes = useCallback(
    async (notes: string) => {
      if (!quest || notes === quest.notes) return;
      run(() => updateQuest(quest, {}, notes));
    },
    [quest, run],
  );

  const addMilestoneTitle = useCallback(
    (title: string) => (quest ? run(() => addMilestone(quest, title)) : Promise.resolve()),
    [quest, run],
  );
  const toggleMilestoneAt = useCallback(
    (index: number) => (quest ? run(() => toggleMilestone(quest, index)) : Promise.resolve()),
    [quest, run],
  );
  const removeMilestoneAt = useCallback(
    (index: number) => (quest ? run(() => removeMilestone(quest, index)) : Promise.resolve()),
    [quest, run],
  );

  const remove = useCallback(async () => {
    if (!quest) return false;
    try {
      await deleteQuest(quest);
      toast.success("Quest moved to archive");
      return true;
    } catch (err) {
      toast.error(`Couldn't delete: ${errMessage(err)}`);
      return false;
    }
  }, [quest]);

  return {
    quest,
    loading,
    notFound,
    error,
    reload,
    patch,
    setStatus,
    rollOver,
    toggleFocus,
    saveNotes,
    addMilestoneTitle,
    toggleMilestoneAt,
    removeMilestoneAt,
    remove,
  };
}
