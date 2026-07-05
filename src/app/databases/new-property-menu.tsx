/**
 * NewPropertyMenu (Ch8 v2) — the "+" at the end of the header row. A popover
 * with an optional name field + a grouped, icon'd type picker (Notion's
 * add-property flow). Picking a type creates the column immediately; the name is
 * optional and defaults to the type's label.
 */

import { TYPE_GROUPS, TYPE_META } from "@/app/databases/db-types";
import { Input } from "@/shared/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import type { DatabaseColumnType } from "@/shared/lib/vault/schemas";
import { Plus } from "lucide-react";
import { useState } from "react";

export function NewPropertyMenu({
  onCreate,
}: {
  onCreate: (type: DatabaseColumnType, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const create = (type: DatabaseColumnType) => {
    onCreate(type, name.trim() || TYPE_META[type].label);
    setName("");
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setName("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-full w-full items-center justify-center text-muted-foreground/60 hover:bg-hover hover:text-foreground"
          aria-label="Add property"
        >
          <Plus className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-0">
        <div className="border-border border-b p-2">
          <Input
            // biome-ignore lint/a11y/noAutofocus: focus the name field when the picker opens
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Property name (optional)"
            className="h-8 text-caption"
          />
        </div>
        <ScrollArea className="max-h-72">
          <div className="p-1">
            {TYPE_GROUPS.map((g) => (
              <div key={g.label}>
                <div className="px-2 py-1 text-caption text-muted-foreground">{g.label}</div>
                {g.types.map((t) => {
                  const Icon = TYPE_META[t].icon;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => create(t)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-body hover:bg-hover"
                    >
                      <Icon className="size-4 text-muted-foreground" />
                      {TYPE_META[t].label}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
