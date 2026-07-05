/**
 * NewHabitDialog — create a habit from the overview page.
 * Mirrors NewQuestDialog exactly in structure and shadcn usage.
 *
 * Required: title + repeat (daily / weekly / every-n-days).
 * Optional: display type, target + unit, area.
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { AREA_OPTIONS } from "@/shared/lib/areas";
import type { CreateHabitInput } from "@/shared/lib/habits/habits";
import { Plus } from "lucide-react";
import { useState } from "react";

export function NewHabitDialog({
  onCreate,
}: {
  onCreate: (input: CreateHabitInput) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [area, setArea] = useState("");
  const [repeat, setRepeat] = useState<"daily" | "weekly" | "every-n-days">("daily");
  const [repeatInterval, setRepeatInterval] = useState("2");
  const [displayType, setDisplayType] = useState<"heatmap" | "bar">("heatmap");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");

  const reset = () => {
    setTitle("");
    setArea("");
    setRepeat("daily");
    setRepeatInterval("2");
    setDisplayType("heatmap");
    setTarget("");
    setUnit("");
  };

  const canSubmit = title.trim().length > 0;

  const submit = async () => {
    if (!canSubmit) return;
    const input: CreateHabitInput = {
      title: title.trim(),
      repeat,
      habit_display: displayType,
    };
    if (area) input.area = area;
    if (repeat === "every-n-days") {
      const n = Number.parseInt(repeatInterval, 10);
      if (n >= 2) input.repeat_interval = n;
    }
    if (displayType === "bar") {
      const t = Number.parseFloat(target);
      if (!Number.isNaN(t) && t > 0) input.habit_target = t;
      if (unit.trim()) input.habit_unit = unit.trim();
    }
    await onCreate(input);
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
          New habit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New habit</DialogTitle>
          <DialogDescription>
            A habit is a recurring task you track over time. Choose how often and how to measure it.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-4 py-2">
            {/* Title */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="habit-title">Name</Label>
              <Input
                id="habit-title"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Go to the gym"
              />
            </div>

            {/* Frequency */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="habit-repeat">Frequency</Label>
              <div className="flex items-center gap-2">
                <Select
                  value={repeat}
                  onValueChange={(v) => setRepeat(v as "daily" | "weekly" | "every-n-days")}
                >
                  <SelectTrigger id="habit-repeat" className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="every-n-days">Every N days</SelectItem>
                  </SelectContent>
                </Select>
                {repeat === "every-n-days" && (
                  <>
                    <span className="text-body text-muted-foreground">every</span>
                    <Input
                      type="number"
                      min={2}
                      max={365}
                      value={repeatInterval}
                      onChange={(e) => setRepeatInterval(e.target.value)}
                      className="w-20"
                    />
                    <span className="text-body text-muted-foreground">days</span>
                  </>
                )}
              </div>
            </div>

            {/* Display type */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="habit-display">Tracking type</Label>
              <Select
                value={displayType}
                onValueChange={(v) => setDisplayType(v as "heatmap" | "bar")}
              >
                <SelectTrigger id="habit-display" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="heatmap">Binary (done / not done)</SelectItem>
                  <SelectItem value="bar">Quantity (track a number)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Quantity target — only if bar */}
            {displayType === "bar" && (
              <div className="flex flex-col gap-2">
                <Label>Target (optional)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder="e.g. 200"
                    className="w-28"
                  />
                  <Input
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="unit (e.g. g)"
                    className="w-28"
                  />
                </div>
              </div>
            )}

            {/* Area */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="habit-area">Area (optional)</Label>
              <Select value={area} onValueChange={(v) => setArea(v ?? "")}>
                <SelectTrigger id="habit-area" className="w-full">
                  <SelectValue placeholder="No area" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No area</SelectItem>
                  {AREA_OPTIONS.map((a) => (
                    <SelectItem key={a.slug} value={a.slug}>
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: a.color }}
                        />
                        {a.label}
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
            <Button type="submit" disabled={!canSubmit}>
              Create habit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
