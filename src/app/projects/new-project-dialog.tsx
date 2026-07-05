/**
 * NewProjectDialog — create a project from the list page. Area is required (the
 * one-home anchor, D3), so the global list needs a picker (unlike the Area-page
 * quick-add, which inherits its area). Title + area + kind; status starts at
 * backlog. Quest/due are left to the detail page (quest assignment waits for Ch6).
 */

import { useAreasContext } from "@/app/areas/areas-provider";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import type { CreateProjectInput } from "@/shared/lib/project-data";
import type { ProjectKind } from "@/shared/lib/vault/schemas";
import { Plus } from "lucide-react";
import { useState } from "react";

export function NewProjectDialog({
  defaultArea,
  onCreate,
}: {
  defaultArea?: string;
  onCreate: (input: CreateProjectInput) => Promise<unknown>;
}) {
  const { topLevelAreas } = useAreasContext();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [area, setArea] = useState<string>(defaultArea ?? "");
  const [kind, setKind] = useState<ProjectKind>("standard");

  const reset = () => {
    setTitle("");
    setArea(defaultArea ?? "");
    setKind("standard");
  };

  const submit = async () => {
    const t = title.trim();
    if (!t || !area) return;
    await onCreate({ title: t, area, kind });
    reset();
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          New project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            A project lives in one area. You can set a quest, due date, and tasks after.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-title">Title</Label>
              <Input
                id="project-title"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What's the project?"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="project-area">Area</Label>
              <Select value={area} onValueChange={(v) => setArea(v ?? "")}>
                <SelectTrigger id="project-area" className="w-full">
                  <SelectValue placeholder="Choose an area" />
                </SelectTrigger>
                <SelectContent>
                  {topLevelAreas.map((a) => (
                    <SelectItem key={a.slug} value={a.slug}>
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: a.color }}
                        />
                        {a.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Kind</Label>
              <div className="flex items-center gap-1">
                {(["standard", "software"] as const).map((k) => (
                  <Button
                    key={k}
                    type="button"
                    variant={kind === k ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setKind(k)}
                    className="capitalize"
                  >
                    {k}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!title.trim() || !area}>
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
