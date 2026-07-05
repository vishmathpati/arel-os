/**
 * NewAreaDialog — create a new top-level Area. Top-level Areas are fully
 * user-defined (no more fixed 6 — extends the same mechanism that already
 * powered sub-area creation, see NewSubAreaDialog). Pattern: mirrors
 * NewSubAreaDialog / NewQuestDialog — shadcn Dialog + Input + Label.
 */

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
import type { CreateAreaInput } from "@/shared/lib/area-data";
import { Plus } from "lucide-react";
import { useState } from "react";

export function NewAreaDialog({
  onCreate,
  trigger,
}: {
  onCreate: (input: CreateAreaInput) => Promise<unknown>;
  /** Custom trigger element (e.g. an empty-state button). Defaults to a
   * "New area" sidebar-style button. */
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const reset = () => {
    setName("");
    setDescription("");
  };

  const submit = async () => {
    const n = name.trim();
    if (!n) return;
    await onCreate({ name: n, description: description.trim() || undefined });
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
        {trigger ?? (
          <Button size="sm" variant="outline">
            <Plus className="size-4" />
            New area
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New area</DialogTitle>
          <DialogDescription>
            Areas are the top-level home for your work — Health, Finance, Work, whatever fits your
            life. Everything you create gets filed to one.
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
              <Label htmlFor="area-name">Name</Label>
              <Input
                id="area-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Health"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="area-description">Description (optional)</Label>
              <Input
                id="area-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="One-line summary"
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!name.trim()}>
              Create area
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
