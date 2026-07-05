/**
 * useTasks — loads tasks from the vault and exposes the mutations the Task page
 * needs. Each mutation updates local state from the confirmed write (the local
 * vault server is sub-millisecond, so this reads as instant). Write failures
 * surface as a manual-dismiss error toast per DESIGN.md.
 */

import { type SchedulePick, resolvePick } from "@/shared/lib/tasks/schedule";
import {
  type CreateTaskInput,
  type Task,
  completeTask,
  createTask,
  deleteTask,
  listTasks,
  reopenTask,
  updateTask,
} from "@/shared/lib/tasks/tasks";
import type { TaskFrontmatter, TaskStatus } from "@/shared/lib/vault/schemas";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export interface UseTasks {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  create: (input: CreateTaskInput) => Promise<Task | null>;
  patch: (task: Task, patch: Partial<TaskFrontmatter>, body?: string) => Promise<void>;
  toggleDone: (task: Task) => Promise<void>;
  setStatus: (task: Task, status: TaskStatus) => Promise<void>;
  reschedule: (task: Task, pick: SchedulePick) => Promise<void>;
  remove: (task: Task) => Promise<void>;
}

const errMessage = (err: unknown): string =>
  err instanceof Error ? err.message : "Something went wrong";

export function useTasks(): UseTasks {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    listTasks()
      .then((next) => setTasks(next))
      .catch((err) => setError(errMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => reload(), [reload]);

  const replace = useCallback((updated: Task) => {
    setTasks((prev) => prev.map((t) => (t.path === updated.path ? updated : t)));
  }, []);

  const create = useCallback(async (input: CreateTaskInput) => {
    try {
      const task = await createTask(input);
      setTasks((prev) => [...prev, task]);
      return task;
    } catch (err) {
      toast.error(`Couldn't create task: ${errMessage(err)}`);
      return null;
    }
  }, []);

  const patch = useCallback(
    async (task: Task, p: Partial<TaskFrontmatter>, body?: string) => {
      try {
        replace(await updateTask(task, p, body));
      } catch (err) {
        toast.error(`Couldn't save: ${errMessage(err)}`);
      }
    },
    [replace],
  );

  const toggleDone = useCallback(
    async (task: Task) => {
      try {
        if (task.status === "done") {
          replace(await reopenTask(task));
          return;
        }
        const { updated, next } = await completeTask(task);
        setTasks((prev) => {
          const mapped = prev.map((t) => (t.path === updated.path ? updated : t));
          return next ? [...mapped, next] : mapped;
        });
      } catch (err) {
        toast.error(`Couldn't update: ${errMessage(err)}`);
      }
    },
    [replace],
  );

  const setStatus = useCallback(
    async (task: Task, status: TaskStatus) => {
      if (status === "done") return toggleDone(task);
      const completed = status === "open" ? undefined : task.completed;
      return patch(task, { status, completed });
    },
    [patch, toggleDone],
  );

  const reschedule = useCallback(
    (task: Task, pick: SchedulePick) => patch(task, { schedule: resolvePick(pick) }),
    [patch],
  );

  const remove = useCallback(async (task: Task) => {
    try {
      await deleteTask(task);
      setTasks((prev) => prev.filter((t) => t.path !== task.path));
      toast.success("Task moved to archive");
    } catch (err) {
      toast.error(`Couldn't delete: ${errMessage(err)}`);
    }
  }, []);

  return {
    tasks,
    loading,
    error,
    reload,
    create,
    patch,
    toggleDone,
    setStatus,
    reschedule,
    remove,
  };
}
