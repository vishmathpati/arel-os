/**
 * Block dialog (Ch14 / D40) — create or edit one Ideal Week block. Controlled by
 * the page (opened from a grid click). Create prefills day + start/end from where
 * you clicked; edit loads the block and adds a Delete action. shadcn Dialog +
 * Select + Input(type=time); optional area + optional Quest/Project/Task link.
 */

import { useAreasContext } from "@/app/areas/areas-provider";
import { TypeIcon } from "@/shared/components/type-icon";
import { Button } from "@/shared/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  type CreateBlockInput,
  DAY_LABEL,
  DEFAULT_DAY_END,
  DEFAULT_DAY_START,
  IDEAL_WEEK_DAYS,
  categoryAccent,
  formatTimeLabel,
  timeOptions,
} from "@/shared/lib/ideal-week";
import { cn } from "@/shared/lib/utils";
import { wikiTarget } from "@/shared/lib/vault/frontmatter";
import type { IdealWeekBlock, IdealWeekCategory, WeekDay } from "@/shared/lib/vault/schemas";
import { Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

export type LinkType = "task" | "project" | "quest";
export interface LinkOption {
  key: string;
  type: LinkType;
  slug: string;
  label: string;
}

const NONE = "__none__";

export interface BlockDraft {
  day: WeekDay;
  start: string;
  end: string;
}

interface BlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present = edit; absent (with `draft`) = create. */
  block?: IdealWeekBlock | null;
  draft?: BlockDraft | null;
  linkOptions: LinkOption[];
  /** Grid window — bounds the start/end time pickers. */
  dayStart?: string;
  dayEnd?: string;
  onSubmit: (input: CreateBlockInput) => void;
  onDelete?: (id: string) => void;
}

export function BlockDialog({
  open,
  onOpenChange,
  block,
  draft,
  linkOptions,
  dayStart = DEFAULT_DAY_START,
  dayEnd = DEFAULT_DAY_END,
  onSubmit,
  onDelete,
}: BlockDialogProps) {
  const { topLevelAreas } = useAreasContext();
  const editing = !!block;
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<IdealWeekCategory>("deep-work");
  const [day, setDay] = useState<WeekDay>("monday");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [area, setArea] = useState<string>(NONE);
  const [link, setLink] = useState<string>("");

  // Load the block (edit) or the click-draft (create) each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    if (block) {
      setLabel(block.label);
      setCategory(block.category);
      setDay(block.day);
      setStart(block.start);
      setEnd(block.end);
      setArea(block.area ?? NONE);
      setLink(block.link ? wikiTarget(block.link) : "");
    } else if (draft) {
      setLabel("");
      setCategory("deep-work");
      setDay(draft.day);
      setStart(draft.start);
      setEnd(draft.end);
      setArea(NONE);
      setLink("");
    }
  }, [open, block, draft]);

  // Start can be any slot up to one step before the window close; end can be any
  // slot after the chosen start. A current value outside the window (e.g. an old
  // block predating a narrowed window) is appended so it stays selectable.
  const allTimes = timeOptions(dayStart, dayEnd);
  const ensure = (opts: { value: string; label: string }[], value: string) =>
    opts.some((o) => o.value === value)
      ? opts
      : [...opts, { value, label: formatTimeLabel(value) }].sort((a, b) =>
          a.value.localeCompare(b.value),
        );
  const startOptions = ensure(allTimes.slice(0, -1), start);
  const endOptions = ensure(
    allTimes.filter((o) => o.value > start),
    end,
  );

  const valid = label.trim() !== "" && start < end;

  const submit = () => {
    if (!valid) return;
    onSubmit({
      day,
      start,
      end,
      label: label.trim(),
      category,
      area: area === NONE ? undefined : area,
      link: link ? `[[${link}]]` : undefined,
    });
    onOpenChange(false);
  };

  const linked = linkOptions.find((o) => o.slug === link);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit block" : "Add block"}</DialogTitle>
          <DialogDescription>
            A recurring block on your ideal week — it repeats every week.
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
              <Label htmlFor="block-label">Label</Label>
              <Input
                id="block-label"
                autoFocus
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="What's this block for?"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="block-category">Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as IdealWeekCategory)}>
                <SelectTrigger id="block-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_ORDER.map((c) => (
                    <SelectItem key={c} value={c}>
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: categoryAccent(c) }}
                        />
                        {CATEGORY_LABEL[c]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="block-day">Day</Label>
                <Select value={day} onValueChange={(v) => setDay(v as WeekDay)}>
                  <SelectTrigger id="block-day" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IDEAL_WEEK_DAYS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {DAY_LABEL[d]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="block-start">Start</Label>
                <TimeSelect
                  id="block-start"
                  value={start}
                  options={startOptions}
                  onChange={(v) => {
                    setStart(v);
                    if (v >= end) {
                      const next = allTimes.find((o) => o.value > v);
                      if (next) setEnd(next.value);
                    }
                  }}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="block-end">End</Label>
                <TimeSelect id="block-end" value={end} options={endOptions} onChange={setEnd} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="block-area">Area (optional)</Label>
              <Select value={area} onValueChange={(v) => setArea(v ?? NONE)}>
                <SelectTrigger id="block-area" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
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
              <Label>Link (optional)</Label>
              {linked ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-body">
                  <TypeIcon type={linked.type} />
                  <span className="min-w-0 flex-1 truncate">{linked.label}</span>
                  <button
                    type="button"
                    aria-label="Clear link"
                    onClick={() => setLink("")}
                    className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <LinkPicker options={linkOptions} onPick={(o) => setLink(o.slug)} />
              )}
            </div>
          </div>

          <DialogFooter className="sm:justify-between">
            {editing && onDelete ? (
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground hover:text-error"
                onClick={() => {
                  onDelete(block.id);
                  onOpenChange(false);
                }}
              >
                <Trash2 className="size-4" />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!valid}>
                {editing ? "Save" : "Add block"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Themed 15-min time picker — a shadcn Select replacing the native time input. */
function TimeSelect({
  id,
  value,
  options,
  onChange,
}: {
  id: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full tabular-nums">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <ScrollArea className="h-60">
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="tabular-nums">
              {o.label}
            </SelectItem>
          ))}
        </ScrollArea>
      </SelectContent>
    </Select>
  );
}

function LinkPicker({
  options,
  onPick,
}: {
  options: LinkOption[];
  onPick: (o: LinkOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const groups: LinkType[] = ["task", "project", "quest"];
  const labels = { task: "Tasks", project: "Projects", quest: "Quests" } as const;

  return (
    // `modal` is required here: this Popover lives inside the Dialog, whose
    // scroll-lock (react-remove-scroll) otherwise swallows wheel events so the
    // command list can't scroll. Modal makes the Popover own its scroll, matching
    // Radix Select's default behavior.
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("w-full justify-start font-normal text-muted-foreground")}
          disabled={!options.length}
        >
          Link a task, project, or quest…
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>Nothing to link.</CommandEmpty>
            {groups.map((g) => {
              const opts = options.filter((o) => o.type === g);
              if (!opts.length) return null;
              return (
                <CommandGroup key={g} heading={labels[g]}>
                  {opts.map((o) => (
                    <CommandItem
                      key={o.key}
                      value={`${o.type} ${o.label}`}
                      onSelect={() => {
                        onPick(o);
                        setOpen(false);
                      }}
                    >
                      <TypeIcon type={o.type} className="size-3.5" />
                      <span className="truncate">{o.label}</span>
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
