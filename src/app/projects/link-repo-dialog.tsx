/**
 * LinkRepoDialog — links a software project to its code folder (D64). The user
 * pastes the folder's absolute path (browsers can't hand us one, so paste is the
 * contract); we validate it live via the engine server (folder exists + has
 * project-protocol files) before enabling Save. This paste field is the one place
 * a raw path is shown — everywhere else stays human-readable.
 *
 * Controlled (no trigger) so the project page can open it from the Kind toggle.
 */

import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { type RepoCheck, checkRepo } from "@/shared/lib/project-dashboard/client";
import { Check, FolderGit2, Loader2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

type CheckState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok"; result: RepoCheck }
  | { kind: "error"; message: string };

export function LinkRepoDialog({
  open,
  onOpenChange,
  currentPath,
  onLink,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPath?: string;
  onLink: (path: string) => Promise<void>;
}) {
  const [path, setPath] = useState(currentPath ?? "");
  const [state, setState] = useState<CheckState>({ kind: "idle" });
  const [saving, setSaving] = useState(false);

  // Reset to the current value whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setPath(currentPath ?? "");
      setState({ kind: "idle" });
    }
  }, [open, currentPath]);

  // Debounced live validation as the path is typed/pasted.
  useEffect(() => {
    const trimmed = path.trim();
    if (!trimmed) {
      setState({ kind: "idle" });
      return;
    }
    let cancelled = false;
    setState({ kind: "checking" });
    const t = setTimeout(() => {
      checkRepo(trimmed)
        .then((result) => {
          if (!cancelled) setState({ kind: "ok", result });
        })
        .catch((err) => {
          if (!cancelled)
            setState({
              kind: "error",
              message: err instanceof Error ? err.message : "Check failed",
            });
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [path]);

  const found = state.kind === "ok" && state.result.exists && state.result.protocolCount > 0;
  const canSave = found && !saving;

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onLink(path.trim());
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderGit2 className="size-4 text-muted-foreground" />
            Link the project's folder
          </DialogTitle>
          <DialogDescription>
            Paste the full path to this project's folder on your Mac. Arel reads its STATUS, BRIEF,
            ROADMAP and other protocol notes to build the dashboard — never your code.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-2 py-2">
            <Label htmlFor="repo-path">Folder path</Label>
            <Input
              id="repo-path"
              autoFocus
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/Users/you/Projects/my-app"
              className="font-mono text-caption"
            />
            <StatusLine state={state} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSave}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {currentPath ? "Update folder" : "Link folder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StatusLine({ state }: { state: CheckState }) {
  if (state.kind === "idle") {
    return (
      <p className="text-caption text-muted-foreground">
        We'll check the folder before linking it.
      </p>
    );
  }
  if (state.kind === "checking") {
    return (
      <p className="flex items-center gap-1.5 text-caption text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Checking the folder…
      </p>
    );
  }
  if (state.kind === "error") {
    return (
      <p className="flex items-center gap-1.5 text-caption text-error">
        <TriangleAlert className="size-3.5" />
        {state.message}
      </p>
    );
  }
  // ok
  const { exists, protocolCount, name } = state.result;
  if (!exists) {
    return (
      <p className="flex items-center gap-1.5 text-caption text-error">
        <TriangleAlert className="size-3.5" />
        That folder doesn't exist or can't be read.
      </p>
    );
  }
  if (protocolCount === 0) {
    return (
      <p className="flex items-center gap-1.5 text-caption text-warning">
        <TriangleAlert className="size-3.5" />
        Found “{name}”, but no project-protocol notes (STATUS, BRIEF…) — the dashboard would be
        empty.
      </p>
    );
  }
  return (
    <p className="flex items-center gap-1.5 text-caption text-success">
      <Check className="size-3.5" />
      Found “{name}” with {protocolCount} protocol {protocolCount === 1 ? "note" : "notes"}.
    </p>
  );
}
