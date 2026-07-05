/**
 * NewSubAreaDialog — create a sub-area under the current top-level area.
 * Only shown on top-level areas (2-level max rule enforced in both UI + backend).
 * Pattern: mirrors NewQuestDialog — shadcn Dialog + Input + Label.
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
import { Plus } from "lucide-react";
import { useState } from "react";

export interface CreateSubAreaInput {
  name: string;
  description?: string;
}

export function NewSubAreaDialog({
  parentName,
  onCreate,
}: {
  parentName: string;
  onCreate: (input: CreateSubAreaInput) => Promise<unknown>;
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
        <Button size="sm" variant="outline">
          <Plus className="size-4" />
          New sub-area
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New sub-area</DialogTitle>
          <DialogDescription>
            Create a sub-area inside {parentName}. Sub-areas share their parent's area — items filed
            here roll up into {parentName}'s view.
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
              <Label htmlFor="sub-area-name">Name</Label>
              <Input
                id="sub-area-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Freelance clients"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="sub-area-description">Description (optional)</Label>
              <Input
                id="sub-area-description"
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
              Create sub-area
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
