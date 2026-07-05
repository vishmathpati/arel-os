"use client";

/**
 * EmojiIconPicker — page-context icon picker. Two tabs: Emoji (full @emoji-mart)
 * and Icons (full Lucide set, searchable, colorable via tag palette). Stores the
 * icon as an emoji char or "lucide:Name" plus an optional icon_color.
 * Trigger is larger than the property header version (size-9 / text-2xl).
 */

import { ColumnIconView } from "@/app/databases/property-icon-picker";
import { Input } from "@/shared/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { PICKER_COLORS } from "@/shared/lib/db-options";
import { cn } from "@/shared/lib/utils";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { FileText, type LucideIcon, icons } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

const LUCIDE = icons as unknown as Record<string, LucideIcon>;
const ALL_ICON_NAMES = Object.keys(LUCIDE).filter(
  (n) => !n.endsWith("Icon") && !n.startsWith("Lucide"),
);

const POPULAR = [
  "Star",
  "Heart",
  "Flag",
  "Bookmark",
  "Tag",
  "Hash",
  "Flame",
  "Zap",
  "Sparkles",
  "Target",
  "Rocket",
  "Lightbulb",
  "Trophy",
  "Crown",
  "Gem",
  "Gift",
  "Bell",
  "Pin",
  "MapPin",
  "Calendar",
  "Clock",
  "CheckCircle",
  "CircleDot",
  "Circle",
  "Square",
  "Triangle",
  "AlertTriangle",
  "Info",
  "User",
  "Users",
  "Building2",
  "Briefcase",
  "Mail",
  "Phone",
  "Globe",
  "Link",
  "Paperclip",
  "FileText",
  "Folder",
  "Image",
  "Video",
  "Music",
  "Camera",
  "Mic",
  "Book",
  "Pencil",
  "Code",
  "Terminal",
  "Database",
  "Server",
  "Cloud",
  "Lock",
  "Key",
  "Shield",
  "Eye",
  "Search",
  "Settings",
  "Wrench",
  "Hammer",
  "DollarSign",
  "CreditCard",
  "ShoppingCart",
  "TrendingUp",
  "BarChart3",
  "PieChart",
  "Activity",
  "Brain",
  "Dumbbell",
  "Coffee",
  "Pizza",
  "Leaf",
  "Sun",
  "Moon",
  "Umbrella",
  "Car",
  "Plane",
  "Home",
  "Map",
  "Compass",
  "Smile",
].filter((n, i, a) => a.indexOf(n) === i && LUCIDE[n]);

function iconColorStyle(color?: string) {
  return color && color !== "default" ? { color: `var(--tag-${color}-fg)` } : undefined;
}

export function EmojiIconPicker({
  value,
  color,
  onSelect,
}: {
  value?: string;
  color?: string;
  onSelect: (icon: string | undefined, color: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"emoji" | "icon">("emoji");
  const [query, setQuery] = useState("");
  const isLucide = value?.startsWith("lucide:");

  const theme =
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";

  const results = useMemo(() => {
    if (!query.trim()) return POPULAR;
    const q = query.toLowerCase();
    return ALL_ICON_NAMES.filter((n) => n.toLowerCase().includes(q)).slice(0, 120);
  }, [query]);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex size-9 shrink-0 items-center justify-center rounded text-2xl leading-none hover:bg-hover"
          aria-label="Set page icon"
        >
          {value ? (
            <ColumnIconView
              icon={value}
              color={color}
              className={isLucide ? "size-6" : undefined}
            />
          ) : (
            <FileText className="size-5 text-muted-foreground" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        {/* Tabs */}
        <div className="flex items-center gap-1 border-border border-b p-1.5">
          <TabBtn active={tab === "emoji"} onClick={() => setTab("emoji")}>
            Emoji
          </TabBtn>
          <TabBtn active={tab === "icon"} onClick={() => setTab("icon")}>
            Icons
          </TabBtn>
          <div className="flex-1" />
          {value && (
            <button
              type="button"
              onClick={() => {
                onSelect(undefined, undefined);
                setOpen(false);
              }}
              className="rounded px-2 py-1 text-caption text-muted-foreground hover:bg-hover hover:text-foreground"
            >
              Remove
            </button>
          )}
        </div>

        {tab === "emoji" ? (
          <Picker
            data={data}
            theme={theme}
            previewPosition="none"
            skinTonePosition="search"
            onEmojiSelect={(e: { native: string }) => {
              onSelect(e.native, undefined);
              setOpen(false);
            }}
          />
        ) : (
          <div className="p-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search icons…"
              className="h-8 text-caption"
            />
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {PICKER_COLORS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => isLucide && onSelect(value, c.name)}
                  title={c.label}
                  className={cn(
                    "size-5 rounded-full border border-border/60",
                    (color ?? "default") === c.name && "ring-2 ring-foreground",
                  )}
                  style={{
                    backgroundColor:
                      c.name === "default" ? "var(--muted)" : `var(--tag-${c.name}-fg)`,
                  }}
                  aria-label={c.label}
                />
              ))}
            </div>
            <ScrollArea className="mt-2 h-48">
              <div className="grid grid-cols-8 gap-0.5 pr-2">
                {results.map((name) => {
                  const Ico = LUCIDE[name];
                  return (
                    <button
                      key={name}
                      type="button"
                      title={name}
                      onClick={() => {
                        onSelect(`lucide:${name}`, color);
                        setOpen(false);
                      }}
                      className="flex size-7 items-center justify-center rounded hover:bg-hover"
                    >
                      <Ico className="size-4" style={iconColorStyle(color)} />
                    </button>
                  );
                })}
                {results.length === 0 && (
                  <p className="col-span-8 py-3 text-center text-caption text-muted-foreground">
                    No icons match.
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded px-2 py-1 text-caption",
        active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-hover",
      )}
    >
      {children}
    </button>
  );
}
