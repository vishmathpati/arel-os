/**
 * NewQuestDialog — create a quest from the list page. Area and deadline are both
 * required (a quest is a goal with a deadline, D2). Title + area + deadline +
 * optional target; status starts at planned. Projects/milestones come after, on
 * the detail page.
 */

import { useAreasContext } from "@/app/areas/areas-provider";
import { Button } from "@/shared/components/ui/button";
import { Calendar } from "@/shared/components/ui/calendar";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import type { CreateQuestInput } from "@/shared/lib/quest-data";
import { toDateStr } from "@/shared/lib/tasks/schedule";
import { cn } from "@/shared/lib/utils";
import { CalendarClock, Plus } from "lucide-react";
import { useState } from "react";

function formatDeadline(d: string): string {
  const date = new Date(`${d}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? d
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function NewQuestDialog({
  defaultArea,
  onCreate,
}: {
  defaultArea?: string;
  onCreate: (input: CreateQuestInput) => Promise<unknown>;
}) {
  const { topLevelAreas } = useAreasContext();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [area, setArea] = useState(defaultArea ?? "");
  const [deadline, setDeadline] = useState("");
  const [target, setTarget] = useState("");
  const [dueOpen, setDueOpen] = useState(false);

  const reset = () => {
    setTitle("");
    setArea(defaultArea ?? "");
    setDeadline("");
    setTarget("");
  };

  const submit = async () => {
    const t = title.trim();
    if (!t || !area || !deadline) return;
    await onCreate({ title: t, area, deadline, target: target.trim() || undefined });
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
          New quest
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New quest</DialogTitle>
          <DialogDescription>
            A quest is a goal with a deadline, in one area. Add milestones and projects after.
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
              <Label htmlFor="quest-title">Title</Label>
              <Input
                id="quest-title"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What's the goal?"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="quest-area">Area</Label>
              <Select value={area} onValueChange={(v) => setArea(v ?? "")}>
                <SelectTrigger id="quest-area" className="w-full">
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
              <Label>Deadline</Label>
              <Popover open={dueOpen} onOpenChange={setDueOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start gap-2 font-normal"
                  >
                    <CalendarClock className="size-4 text-muted-foreground" />
                    <span className={cn(!deadline && "text-muted-foreground")}>
                      {deadline ? formatDeadline(deadline) : "Pick a deadline"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-2">
                  <Calendar
                    mode="single"
                    selected={deadline ? new Date(`${deadline}T00:00:00`) : undefined}
                    onSelect={(date) => {
                      if (date) setDeadline(toDateStr(date));
                      setDueOpen(false);
                    }}
                    className="p-0"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="quest-target">Target (optional)</Label>
              <Input
                id="quest-target"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="e.g. read 12 books"
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!title.trim() || !area || !deadline}>
              Create quest
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
