/**
 * useProjects — loads all projects for the list page and exposes the mutations
 * it needs. Confirmed writes update local state (the local vault server is
 * sub-ms, so it reads as instant); failures surface as a manual-dismiss toast.
 */

import {
  type CreateProjectInput,
  type Project,
  createProject,
  deleteProject,
  listProjects,
  updateProject,
} from "@/shared/lib/project-data";
import type { ProjectFrontmatter, ProjectStatus } from "@/shared/lib/vault/schemas";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export interface UseProjects {
  projects: Project[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  create: (input: CreateProjectInput) => Promise<Project | null>;
  setStatus: (project: Project, status: ProjectStatus) => Promise<void>;
  patch: (project: Project, patch: Partial<ProjectFrontmatter>) => Promise<void>;
  remove: (project: Project) => Promise<void>;
}

const errMessage = (err: unknown): string =>
  err instanceof Error ? err.message : "Something went wrong";

export function useProjects(): UseProjects {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    listProjects()
      .then(setProjects)
      .catch((err) => setError(errMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => reload(), [reload]);

  const replace = useCallback((updated: Project) => {
    setProjects((prev) => prev.map((p) => (p.path === updated.path ? updated : p)));
  }, []);

  const create = useCallback(async (input: CreateProjectInput) => {
    try {
      const project = await createProject(input);
      setProjects((prev) => [...prev, project]);
      toast.success("Project created");
      return project;
    } catch (err) {
      toast.error(`Couldn't create project: ${errMessage(err)}`);
      return null;
    }
  }, []);

  const patch = useCallback(
    async (project: Project, p: Partial<ProjectFrontmatter>) => {
      try {
        replace(await updateProject(project, p));
      } catch (err) {
        toast.error(`Couldn't save: ${errMessage(err)}`);
      }
    },
    [replace],
  );

  const setStatus = useCallback(
    (project: Project, status: ProjectStatus) => patch(project, { status }),
    [patch],
  );

  const remove = useCallback(async (project: Project) => {
    try {
      await deleteProject(project);
      setProjects((prev) => prev.filter((p) => p.path !== project.path));
      toast.success("Project moved to archive");
    } catch (err) {
      toast.error(`Couldn't delete: ${errMessage(err)}`);
    }
  }, []);

  return { projects, loading, error, reload, create, setStatus, patch, remove };
}
