/**
 * NewDatabaseDialog — create a custom database inside an area (Ch8). Name is
 * required; area is prefilled when created from an Area page. Columns start
 * empty and are added inline via the table's "+" header button.
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
import type { CreateDatabaseInput, DatabaseConfig } from "@/shared/lib/database-data";
import { Database, Plus } from "lucide-react";
import { useState } from "react";

const STANDALONE = "__standalone__";

export function NewDatabaseDialog({
  defaultArea,
  onCreate,
}: {
  defaultArea?: string;
  onCreate: (input: CreateDatabaseInput) => Promise<DatabaseConfig>;
}) {
  const { topLevelAreas } = useAreasContext();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [area, setArea] = useState(defaultArea ?? STANDALONE);

  const reset = () => {
    setName("");
    setDescription("");
    setArea(defaultArea ?? STANDALONE);
  };

  const submit = async () => {
    const n = name.trim();
    if (!n) return;
    await onCreate({
      name: n,
      area: area === STANDALONE ? undefined : area,
      description: description.trim() || undefined,
    });
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
        <Button variant="outline" size="sm">
          <Plus className="size-4" />
          New database
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="size-4" />
            New database
          </DialogTitle>
          <DialogDescription>
            A structured set of records (a table you maintain). Add columns after creating it.
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
              <Label htmlFor="db-name">Name</Label>
              <Input
                id="db-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Subscriptions, Food log"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="db-desc">Description (optional)</Label>
              <Input
                id="db-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this database track?"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="db-area">Area (optional)</Label>
              <Select value={area} onValueChange={setArea}>
                <SelectTrigger id="db-area" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={STANDALONE}>Standalone (no area)</SelectItem>
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
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!name.trim()}>
              Create database
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
