/**
 * useProject — loads one project for the detail page and exposes its mutations
 * (status / kind / quest / due / description / delete). Same shape as useArea:
 * confirmed writes update local state; failures toast.
 */

import { type Project, deleteProject, readProject, updateProject } from "@/shared/lib/project-data";
import type { ProjectFrontmatter, ProjectKind, ProjectStatus } from "@/shared/lib/vault/schemas";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export interface UseProject {
  project: Project | null;
  loading: boolean;
  notFound: boolean;
  error: string | null;
  reload: () => void;
  patch: (patch: Partial<ProjectFrontmatter>) => Promise<void>;
  setStatus: (status: ProjectStatus) => Promise<void>;
  setKind: (kind: ProjectKind) => Promise<void>;
  saveDescription: (description: string) => Promise<void>;
  remove: () => Promise<boolean>;
}

const errMessage = (err: unknown): string =>
  err instanceof Error ? err.message : "Something went wrong";

export function useProject(slug: string): UseProject {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    readProject(slug)
      .then((p) => {
        if (!p) setNotFound(true);
        setProject(p);
      })
      .catch((err) => setError(errMessage(err)))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => reload(), [reload]);

  const patch = useCallback(
    async (p: Partial<ProjectFrontmatter>) => {
      if (!project) return;
      try {
        setProject(await updateProject(project, p));
      } catch (err) {
        toast.error(`Couldn't save: ${errMessage(err)}`);
      }
    },
    [project],
  );

  const setStatus = useCallback((status: ProjectStatus) => patch({ status }), [patch]);
  const setKind = useCallback((kind: ProjectKind) => patch({ kind }), [patch]);

  const saveDescription = useCallback(
    async (description: string) => {
      if (!project || description === project.description) return;
      try {
        setProject(await updateProject(project, {}, description));
      } catch (err) {
        toast.error(`Couldn't save description: ${errMessage(err)}`);
      }
    },
    [project],
  );

  const remove = useCallback(async () => {
    if (!project) return false;
    try {
      await deleteProject(project);
      toast.success("Project moved to archive");
      return true;
    } catch (err) {
      toast.error(`Couldn't delete: ${errMessage(err)}`);
      return false;
    }
  }, [project]);

  return {
    project,
    loading,
    notFound,
    error,
    reload,
    patch,
    setStatus,
    setKind,
    saveDescription,
    remove,
  };
}
