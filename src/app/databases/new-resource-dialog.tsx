/**
 * NewResourceDialog — add a Library resource (Ch8). Title is required; kind,
 * source URL, and area are optional. Status starts at "unsorted". Project/quest
 * links are set from the entity pages (filtered views), not here.
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
import type { CreateResourceInput } from "@/shared/lib/resource-data";
import type { ResourceKind } from "@/shared/lib/vault/schemas";
import { Plus } from "lucide-react";
import { useState } from "react";

const KINDS: ResourceKind[] = ["link", "video", "tweet", "image", "note"];

export function NewResourceDialog({
  defaultArea,
  onCreate,
}: {
  defaultArea?: string;
  onCreate: (input: CreateResourceInput) => Promise<unknown>;
}) {
  const { topLevelAreas } = useAreasContext();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<ResourceKind>("link");
  const [url, setUrl] = useState("");
  const [area, setArea] = useState(defaultArea ?? "");

  const reset = () => {
    setTitle("");
    setKind("link");
    setUrl("");
    setArea(defaultArea ?? "");
  };

  const submit = async () => {
    const t = title.trim();
    if (!t) return;
    await onCreate({
      title: t,
      resource_kind: kind,
      url: url.trim() || undefined,
      area: area || undefined,
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
        <Button size="sm">
          <Plus className="size-4" />
          New resource
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New resource</DialogTitle>
          <DialogDescription>
            Add a link, video, note, or other resource to your Library.
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
              <Label htmlFor="res-title">Title</Label>
              <Input
                id="res-title"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What is it?"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="res-kind">Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as ResourceKind)}>
                <SelectTrigger id="res-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k} value={k} className="capitalize">
                      {k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="res-url">Source URL (optional)</Label>
              <Input
                id="res-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="res-area">Area (optional)</Label>
              <Select value={area} onValueChange={(v) => setArea(v ?? "")}>
                <SelectTrigger id="res-area" className="w-full">
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
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!title.trim()}>
              Add resource
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
