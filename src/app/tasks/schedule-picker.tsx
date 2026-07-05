/**
 * SchedulePicker — the Popover for axis 2. Six quick buckets + a Calendar for an
 * exact date. Reused by the row schedule chip and the detail sheet. Picks resolve
 * to concrete dates upstream (useTasks → resolvePick).
 */

import { Button } from "@/shared/components/ui/button";
import { Calendar } from "@/shared/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Separator } from "@/shared/components/ui/separator";
import { type SchedulePick, toDateStr } from "@/shared/lib/tasks/schedule";
import type { TaskSchedule } from "@/shared/lib/vault/schemas";
import { Archive, CalendarRange, CircleSlash, Moon, Sun, Sunrise } from "lucide-react";
import { type ReactElement, useState } from "react";

interface SchedulePickerProps {
  value: TaskSchedule;
  onPick: (pick: SchedulePick) => void;
  /** The trigger element (e.g. the schedule chip). */
  children: ReactElement;
}

const QUICK: ReadonlyArray<{
  pick: Exclude<SchedulePick, { date: string }>;
  label: string;
  icon: typeof Sun;
}> = [
  { pick: "today", label: "Today", icon: Sun },
  { pick: "this-evening", label: "This evening", icon: Moon },
  { pick: "tomorrow", label: "Tomorrow", icon: Sunrise },
  { pick: "this-week", label: "This week", icon: CalendarRange },
  { pick: "someday", label: "Someday", icon: Archive },
  { pick: "unscheduled", label: "Unscheduled", icon: CircleSlash },
];

/** The currently-selected calendar date, if the schedule holds a concrete date. */
function selectedDate(value: TaskSchedule): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
}

export function SchedulePicker({ value, onPick, children }: SchedulePickerProps) {
  const [open, setOpen] = useState(false);

  const choose = (pick: SchedulePick) => {
    onPick(pick);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-auto gap-0 p-2">
        <div className="grid grid-cols-2 gap-1">
          {QUICK.map(({ pick, label, icon: Icon }) => (
            <Button
              key={label}
              variant="ghost"
              size="sm"
              className="justify-start gap-2"
              onClick={() => choose(pick)}
            >
              <Icon className="size-4 text-muted-foreground" />
              {label}
            </Button>
          ))}
        </div>
        <Separator className="my-2" />
        <Calendar
          mode="single"
          selected={selectedDate(value)}
          onSelect={(date) => date && choose({ date: toDateStr(date) })}
          className="p-0"
        />
      </PopoverContent>
    </Popover>
  );
}
