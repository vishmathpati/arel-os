/**
 * TargetPicker (Ch12) — pick what you're working on for a focus session. Spans
 * the four target kinds (task / project / quest / area) in one Command popover,
 * mirroring the Ch11 Plan-tomorrow picker so the rituals feel like one system.
 */

import { useAreasContext } from "@/app/areas/areas-provider";
import { TypeIcon } from "@/shared/components/type-icon";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import type { FocusTarget, FocusTargetKind } from "@/shared/lib/focus/contract";
import type { PrimitiveTypeKey } from "@/shared/lib/primitives";
import { cn } from "@/shared/lib/utils";
import { useState } from "react";

export interface TargetOption extends FocusTarget {
  key: string;
  area?: string;
}

const GROUPS: { kind: FocusTargetKind; heading: string }[] = [
  { kind: "task", heading: "Tasks" },
  { kind: "project", heading: "Projects" },
  { kind: "quest", heading: "Quests" },
  { kind: "area", heading: "Areas" },
];

/**
 * Render a focus target's identity icon. Task/Project/Quest use the universal
 * type identity (registry icon + type tint). An Area is self-identifying — it
 * uses its own per-area icon + color (its slug is the target slug).
 */
function TargetIcon({
  kind,
  slug,
  className,
}: { kind: FocusTargetKind; slug: string; className?: string }) {
  const { byWikilink } = useAreasContext();
  if (kind === "area") {
    const area = byWikilink(slug);
    if (!area) return null;
    const Icon = area.icon;
    return (
      <Icon
        className={cn("size-4 shrink-0", className)}
        style={{ color: area.color }}
        aria-hidden
      />
    );
  }
  return <TypeIcon type={kind as PrimitiveTypeKey} className={className} />;
}

export function TargetPicker({
  candidates,
  selected,
  onSelect,
}: {
  candidates: TargetOption[];
  selected: FocusTarget | null;
  onSelect: (target: TargetOption) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors duration-fast hover:bg-hover",
            !selected && "text-muted-foreground",
          )}
        >
          {selected ? (
            <TargetIcon kind={selected.kind} slug={selected.slug} />
          ) : (
            <TypeIcon type="task" className="opacity-40" />
          )}
          <span className="min-w-0 flex-1 truncate text-body">
            {selected ? selected.title : "Choose a task, project, quest, or area…"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search anything to focus on…" />
          <CommandList>
            <CommandEmpty>Nothing to focus on yet.</CommandEmpty>
            {GROUPS.map(({ kind, heading }) => {
              const opts = candidates.filter((c) => c.kind === kind);
              if (!opts.length) return null;
              return (
                <CommandGroup key={kind} heading={heading}>
                  {opts.map((c) => (
                    <CommandItem
                      key={c.key}
                      value={`${c.kind} ${c.title}`}
                      onSelect={() => {
                        onSelect(c);
                        setOpen(false);
                      }}
                    >
                      <TargetIcon kind={c.kind} slug={c.slug} className="size-3.5" />
                      <span className="truncate">{c.title}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
