/**
 * Check-in kit (Ch10/Ch11) — the shared visual language for the daily rituals.
 * The Morning Manifesto and Evening Shutdown both compose their check-ins from
 * these primitives so the two pages feel like one system: bordered `bg-muted/20`
 * SECTION wells of divided label-left/value-right ROWS, plus the mood face-tile
 * and energy level-meter controls. Neutral surfaces only (no new color, no emoji
 * — Lucide faces); selection reads through bg-accent.
 */

import { cn } from "@/shared/lib/utils";
import { Angry, Frown, Laugh, type LucideIcon, Meh, Smile } from "lucide-react";

export const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

// ── Scaffold ─────────────────────────────────────────────────────────────────

/** A labelled group: a small section header above a bordered well of rows. */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="px-1 text-caption font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border bg-muted/20">
        {children}
      </div>
    </section>
  );
}

/** A row inside a well: icon + label on the left, the control/value on the right. */
export function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex items-center gap-2 text-body sm:w-40 sm:shrink-0">
        <Icon className="size-4 text-muted-foreground" />
        {label}
      </div>
      <div className="min-w-0 sm:flex sm:flex-1 sm:justify-end">{children}</div>
    </div>
  );
}

/** A full-width block inside a well (label on top) — for long text like a dump. */
export function Block({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 px-4 py-3.5">
      <div className="flex items-center gap-2 text-body">
        <Icon className="size-4 text-muted-foreground" />
        {label}
      </div>
      {children}
    </div>
  );
}

export function NotSet() {
  return <span className="text-body text-muted-foreground/50">Not set</span>;
}

// ── Mood (1–5 face tiles) ────────────────────────────────────────────────────

export const MOODS: ReadonlyArray<{ value: number; icon: LucideIcon; label: string }> = [
  { value: 1, icon: Angry, label: "Rough" },
  { value: 2, icon: Frown, label: "Low" },
  { value: 3, icon: Meh, label: "Okay" },
  { value: 4, icon: Smile, label: "Good" },
  { value: 5, icon: Laugh, label: "Great" },
];

/** Editable mood scale — five labelled face tiles. */
export function MoodTiles({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (mood: number) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5 sm:w-[22rem]">
      {MOODS.map(({ value: v, icon: Icon, label }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(v)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-md border py-2 transition-colors duration-fast",
              active
                ? "border-foreground/25 bg-accent text-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-hover hover:text-foreground",
            )}
          >
            <Icon className="size-5" />
            <span className="text-caption">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Read-only mood — the selected face + its label. */
export function MoodValue({ value }: { value: number | undefined }) {
  const mood = MOODS.find((x) => x.value === value);
  if (!mood) return <NotSet />;
  return (
    <span className="flex items-center gap-2">
      <mood.icon className="size-5" />
      <span className="text-body">{mood.label}</span>
    </span>
  );
}

// ── Energy (1–5 level meter) ─────────────────────────────────────────────────

export const ENERGY = [1, 2, 3, 4, 5] as const;
/** Bar heights for the level meter (4px scale). */
const BAR_H = ["h-2", "h-3", "h-4", "h-5", "h-6"] as const;

/** Editable energy — a clickable filling level meter. */
export function EnergyMeter({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (energy: number | undefined) => void;
}) {
  return (
    <span className="flex items-end gap-1">
      {ENERGY.map((v) => {
        const on = value !== undefined && value >= v;
        return (
          <button
            key={v}
            type="button"
            aria-label={`Energy ${v}`}
            aria-pressed={value === v}
            onClick={() => onChange(value === v ? undefined : v)}
            className="flex h-8 w-7 items-end justify-center rounded-md hover:bg-hover"
          >
            <span
              className={cn(
                "w-5 rounded-sm transition-all",
                BAR_H[v - 1],
                on ? "bg-primary" : "bg-border",
              )}
            />
          </button>
        );
      })}
      <span className="ml-2 self-center text-caption tabular-nums text-muted-foreground">
        {value ? `${value}/5` : "–"}
      </span>
    </span>
  );
}

/** Read-only energy level meter. */
export function LevelMeter({ value }: { value: number | undefined }) {
  return (
    <span className="flex items-end gap-1">
      {ENERGY.map((v) => (
        <span
          key={v}
          className={cn(
            "w-5 rounded-sm",
            BAR_H[v - 1],
            value && value >= v ? "bg-primary" : "bg-border",
          )}
        />
      ))}
      <span className="ml-2 self-center text-caption tabular-nums text-muted-foreground">
        {value ? `${value}/5` : "–"}
      </span>
    </span>
  );
}
