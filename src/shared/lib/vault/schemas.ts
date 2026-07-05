/**
 * Vault frontmatter contracts — the TypeScript shape of every primitive's YAML
 * frontmatter. These types are the unit of work (CLAUDE.md): the file IS the
 * record, frontmatter IS the schema. Browser-safe (pure types, no runtime).
 *
 * Locked decisions (agents/BRIEF.md): taxonomy (D1), quest lifecycle (D2),
 * project lifecycle (D3), three-axis task model (D4), knowing layer (D5),
 * storage model (D6), database engine (D7), soft-delete (D12).
 */

/** ISO 8601 timestamp, e.g. "2026-06-14T17:09:00.000Z". */
export type ISODateTime = string;
/** YYYY-MM-DD or full ISO datetime. */
export type DateOrDateTime = string;
/** A wikilink written in frontmatter, e.g. "[[health]]" or "[[health|Health]]". */
export type Wikilink = string;

/** Discriminator for every vault document. */
export type PrimitiveType =
  | "area"
  | "quest"
  | "project"
  | "task"
  | "page"
  | "resource"
  | "database"
  | "inbox"
  | "daily"
  | "weekly"
  | "ideal-week";

/** The 6 locked top-level Areas (D1). No "relationship". */
export type AreaSlug = "health" | "finance" | "learning" | "spirituality" | "youtube" | "business";

/**
 * Fields shared by every document. `created`/`updated` are stamped by the
 * write layer. `deleted`/`deleted_from` are added by soft-delete only (D12).
 */
export interface BaseFrontmatter {
  type: PrimitiveType;
  title?: string;
  created: ISODateTime;
  updated: ISODateTime;
  /** Soft-delete marker — present only on files under archive/deleted/ (D12). */
  deleted?: true;
  /** Original relative vault path the file was deleted from (D12). */
  deleted_from?: string;
}

// ── Area (D1) ────────────────────────────────────────────────────────────────

export interface AreaFrontmatter extends BaseFrontmatter {
  type: "area";
  /** Canonical slug or self-wikilink. */
  area: AreaSlug | Wikilink;
  name: string;
  description?: string;
  /** DESIGN.md color token name (e.g. "purple-500"). */
  color?: string;
  /** Lucide icon name. */
  icon?: string;
  /** Parent area for sub-areas (nests 2 levels max). */
  parent?: Wikilink;
  order?: number;
  /** Areas have no status workflow — only an archived flag (D1). */
  archived?: boolean;
}

// ── Quest (D2) ───────────────────────────────────────────────────────────────

export type QuestStatus = "planned" | "active" | "paused" | "done" | "dropped";

export interface Milestone {
  title: string;
  reached: boolean;
  reached_at?: ISODateTime;
}

export interface QuestFrontmatter extends BaseFrontmatter {
  type: "quest";
  /** One-home anchor — required (D2). */
  area: Wikilink;
  status: QuestStatus;
  /** Quest = goal + deadline; deadline is required (D2). */
  deadline: DateOrDateTime;
  /** This week's Focus — separate axis from status (D2). */
  focus?: boolean;
  /** Optional measurable target (e.g. "read 12 books"). */
  target?: string;
  milestones?: Milestone[];
}

// ── Project (D3) ─────────────────────────────────────────────────────────────

export type ProjectStatus = "backlog" | "active" | "paused" | "waiting" | "done" | "dropped";

/** software → gets agent scaffolding + Sync (Act 5); standard → just tasks. */
export type ProjectKind = "software" | "standard";

export interface ProjectFrontmatter extends BaseFrontmatter {
  type: "project";
  /** One-home anchor — required (D3). */
  area: Wikilink;
  status: ProjectStatus;
  kind: ProjectKind;
  /** Optional parent quest (D3). */
  quest?: Wikilink;
  /** Optional due date. */
  due?: DateOrDateTime;
  /** Re-homed from an ended quest — surfaced in Weekly Review (D2). */
  demoted?: boolean;
  /**
   * Absolute path to this project's repo folder, set when kind === "software"
   * (D63/D64). The `project-sync` recipe reads protocol markdown under here to
   * build the dashboard snapshot; the Engine's project-read/design-tokens tools
   * are allowlisted to the live set of these paths. One folder per project — no
   * parent-folder auto-discovery. Absent until the folder is linked.
   */
  repo_path?: string;
}

// ── Task (D4 — three independent axes, no duration) ──────────────────────────

/** Axis 1 — STATUS. */
export type TaskStatus = "open" | "waiting" | "done" | "dropped";

/**
 * Axis 2 — SCHEDULE, non-dated states. The dated buckets the picker offers
 * (today / this-evening / tomorrow / this-week) RESOLVE to a concrete date when
 * chosen (Chapter 3 Contract) — they are never stored as labels. Only these two
 * remain label-only and never go overdue.
 */
export type TaskScheduleLabel = "someday" | "unscheduled";

/**
 * Axis 2 — what is stored: a concrete `YYYY-MM-DD` (or ISO datetime when a time
 * was picked / "this evening"), or a non-dated label. Display grouping (Overdue,
 * Today, This Evening, …) is DERIVED from this value — see
 * `src/shared/lib/tasks/schedule.ts`.
 */
export type TaskSchedule = DateOrDateTime | TaskScheduleLabel;

/** Axis 3a — REPEAT rule. `every-n-days` pairs with `repeat_interval`. */
export type TaskRepeatRule = "none" | "daily" | "every-n-days" | "weekly" | "monthly";

/** Optional atomic sub-step (not a nested task) (D4). */
export interface TaskStep {
  title: string;
  done: boolean;
}

/** One logged habit completion — one entry per completed occurrence. */
export interface HabitCompletion {
  /** YYYY-MM-DD */
  date: string;
  /** Only used when habit_display === "bar" (quantity habits). */
  value?: number;
}

export interface TaskFrontmatter extends BaseFrontmatter {
  type: "task";
  status: TaskStatus; // axis 1
  schedule: TaskSchedule; // axis 2 (concrete date/datetime, or someday/unscheduled)
  repeat: TaskRepeatRule; // axis 3a
  /** Interval in days when repeat === "every-n-days". */
  repeat_interval?: number;
  /** Axis 3b — reminder toggle (NOTIFY). */
  notify: boolean;
  /** Remind this many minutes BEFORE the scheduled time (pairs with notify). */
  notify_lead?: number;
  /** Pure nudge — fires a reminder but hides from the work lists (Today/Week). */
  reminder_only?: boolean;
  /** One-home anchor — optional until triaged out of the Inbox (D4). */
  area?: Wikilink;
  /** Optional context (auto-inherited when created inside one). */
  project?: Wikilink;
  quest?: Wikilink;
  /** Stamp set when status flips to "done". */
  completed?: ISODateTime;
  steps?: TaskStep[];
  // ── Habit tracking extension ─────────────────────────────────────────────────
  /** true = this recurring task is also a tracked habit. */
  habit?: boolean;
  /** "heatmap" = binary done/not (default); "bar" = quantity tracked per day. */
  habit_display?: "heatmap" | "bar";
  /** Quantity target per occurrence (e.g. 200 for grams of protein). */
  habit_target?: number;
  /** Unit label for the target (e.g. "g", "min", "reps"). */
  habit_unit?: string;
  /** Lucide icon name (e.g. "Dumbbell", "Apple"). Optional display. */
  habit_icon?: string;
  /** Completions log — one entry per completed occurrence. */
  completions?: HabitCompletion[];
}

// ── Page (D5 — the one content unit, edited via Plate) ───────────────────────

export interface PageFrontmatter extends BaseFrontmatter {
  type: "page";
  area?: Wikilink;
  /** Parent page for subpage nesting (D5). */
  parent?: Wikilink;
  quest?: Wikilink;
  project?: Wikilink;
  tags?: string[];
  /** Notion-style page icon: emoji char or "lucide:Name". */
  icon?: string;
  /** Tag-color name applied to a Lucide icon (e.g. "blue", "red"). */
  icon_color?: string;
}

// ── Resource (D5 — a Page with source properties; a Library row) ─────────────

export type ResourceKind = "link" | "tweet" | "video" | "image" | "note" | "article";

// ── Rich capture fields (D33 — Arel Clipper rich web objects) ────────────────
// Optional metadata that lets a tweet/video render as a real card. Carried on
// both inbox items and resources so a filed capture renders identically in the
// Library. Media `url`s are vault-relative (`media/x.jpg`, downloaded — e.g. X
// avatars/images) or remote absolute (e.g. YouTube thumbnails, referenced).

export type CaptureMediaKind = "image" | "video" | "poster" | "thumbnail";

export interface CaptureMedia {
  url: string;
  kind: CaptureMediaKind;
  alt?: string;
}

/** A quoted tweet or one item of a thread — a tweet body without its own home. */
export interface CaptureRef {
  author?: string;
  handle?: string;
  text_markdown?: string;
  profile_image?: string;
  media?: CaptureMedia[];
}

export interface CaptureFields {
  // Tweet / X article
  author?: string;
  handle?: string;
  /** Author avatar — vault path (downloaded) or remote URL. */
  profile_image?: string;
  /** Rich tweet/article text (markdown). Mirrors the body for cards. */
  text_markdown?: string;
  tweet_id?: string;
  /** tweet | quote | reply | repost | thread */
  tweet_subtype?: string;
  quoted_tweet?: CaptureRef;
  /** The parent tweet this one replies to (the "Replying to @x" context). */
  reply_to?: CaptureRef;
  thread_items?: CaptureRef[];
  // YouTube
  channel?: string;
  channel_url?: string;
  /** Video thumbnail — remote URL (i.ytimg.com), not downloaded. */
  thumbnail?: string;
  duration?: string;
  video_id?: string;
  // Shared
  media?: CaptureMedia[];
}

export interface ResourceFrontmatter extends BaseFrontmatter, CaptureFields {
  type: "resource";
  resource_kind: ResourceKind;
  area?: Wikilink;
  url?: string;
  source?: string;
  clipped_at?: ISODateTime;
  /** unsorted → still to be filed; filed → assigned an Area/context. */
  status?: "unsorted" | "filed";
  /** Linked project/quest power the filtered Library views (D5). */
  project?: Wikilink;
  quest?: Wikilink;
  tags?: string[];
}

// ── Database config (D7 — thin query engine over frontmatter) ────────────────

export type DatabaseColumnType =
  | "text"
  | "number"
  | "select"
  | "multi_select"
  | "status"
  | "date"
  | "checkbox"
  | "url"
  | "email"
  | "phone"
  | "relation"
  | "files"
  | "created"
  | "updated";

/** A status column's option group (e.g. "To-do" → ["Not started"]). */
export interface StatusGroup {
  label: string;
  options: string[];
}

/** Display format for a date column (Notion-style secondary option). */
export type DateFormat = "full" | "friendly" | "numeric" | "iso" | "relative";
/** Display format for a number column. */
export type NumberFormat = "plain" | "comma" | "percent" | "usd" | "eur" | "gbp" | "inr";

export interface DatabaseColumn {
  key: string;
  label: string;
  type: DatabaseColumnType;
  /** Optional icon beside the property name: an emoji (e.g. "⭐") or a Lucide
   * icon reference (e.g. "lucide:Star"). */
  icon?: string;
  /** Tag-color name applied to a Lucide `icon` (emojis ignore this). */
  icon_color?: string;
  /** Allowed values when type === "select" | "multi_select". */
  options?: string[];
  /** Grouped options when type === "status". */
  groups?: StatusGroup[];
  /** Option → color-name map (Ch8 colored chips, e.g. "Done" → "green"). */
  option_colors?: Record<string, string>;
  /** Hidden from the table view (still stored); toggled in the Properties panel. */
  hidden?: boolean;
  /** Persisted column width in px (drag-to-resize). */
  width?: number;
  /** Date column display format + whether to show the time. */
  date_format?: DateFormat;
  include_time?: boolean;
  /** Number column display format. */
  number_format?: NumberFormat;
  /**
   * Which database this relation points to: a database slug, or the built-in
   * "areas" / "pages" sets. Absent ⇒ legacy areas+pages (backward-compat).
   */
  relation_target?: string;
  /** Allow linking multiple rows (default true). Single when explicitly false. */
  relation_multiple?: boolean;
}

export interface DatabaseFrontmatter extends BaseFrontmatter {
  type: "database";
  name: string;
  area?: Wikilink;
  description?: string;
  columns?: DatabaseColumn[];
  /** Render the table edge-to-edge (full width) vs. width-capped + centered. */
  full_width?: boolean;
}

// ── Inbox item (D5 — universal parking lot) ──────────────────────────────────

export type InboxKind = "task" | "resource";

export interface InboxFrontmatter extends BaseFrontmatter, CaptureFields {
  type: "inbox";
  kind: InboxKind;
  /** Sub-type when kind === "resource". */
  resource_kind?: ResourceKind;
  url?: string;
  source?: string;
  tags?: string[];
}

// ── Daily note (D9/D34 — morning manifesto + evening shutdown share one file) ─

/** Headspace tag — fixed pickable set (D34). */
export type Headspace = "clear" | "optimistic" | "neutral" | "anxious" | "heavy" | "scattered";

/** Q5 — is the dominant thought pulling forward or holding back (D34). */
export type ThoughtValence = "forward" | "mixed" | "holding";

/**
 * Morning check-in answers (D34). The 7 fixed core questions; Q8
 * ("what would make today a win") is stored as `must_do[]` on the note.
 * Numbers/enums are deliberate — a future trends view charts them.
 */
export interface DailyMorning {
  /** Q1 — mood, 1–5. */
  mood?: number;
  /** Q2 — energy, 1–5. */
  energy?: number;
  /** Q3 — headspace tag. */
  headspace?: Headspace;
  /** Q4 — what's on your mind (free text). */
  mind_dump?: string;
  /** Q5 — forward / mixed / holding back. */
  thought_valence?: ThoughtValence;
  /** Q6 — gratitude (short text). */
  gratitude?: string;
  /** Q7 — intention for today (one line). */
  intention?: string;
}

/** Did the day match this morning's intention (D35 — closes the daily loop). */
export type IntentionMatch = "yes" | "partly" | "no";

/**
 * Evening shutdown answers (D35). Backward-looking counterpart to `morning`:
 * a night check-in (mood/energy left/intention match + reflection) plus the
 * tomorrow plan. The Inbox-zero step acts on inbox files directly (not stored
 * here). Numbers/enums mirror `morning` so a future trends view charts both.
 */
export interface DailyEvening {
  /** End-of-day mood, 1–5. */
  mood?: number;
  /** Energy left, 1–5. */
  energy?: number;
  /** Did today match the morning intention. */
  intention_match?: IntentionMatch;
  /** What went well today. */
  wins?: string;
  /** What's still open / on your mind. */
  open_loops?: string;
  /** A closing line — what you're letting go of. */
  letting_go?: string;
  /** Work lined up for tomorrow — task / project / quest wikilinks. */
  tomorrow_focus?: Wikilink[];
  /** The single first move for tomorrow. */
  tomorrow_first_task?: Wikilink;
}

/**
 * One logged Focus Session (Ch12 — D-pending). Appended to the daily note's
 * `sessions[]` each time a session ends. Standalone sessions fill what Arel OS
 * knows; connected sessions (a profile was selected → Arel Focus blocked sites)
 * enrich with telemetry copied from the Arel Focus result file.
 */
export interface FocusLog {
  /** afh-YYYYMMDDhhmmss-xxxxxx. */
  id: string;
  /** What was worked on — task/project/quest/area all map here. */
  target: { slug: string; kind: "task" | "project" | "quest" | "area"; title: string };
  /** Absent = standalone (no blocking profile selected). */
  profile_id?: string;
  planned: { plan_min: number; work_min: number; reflect_min: number };
  actual: { plan_min: number; work_min: number; reflect_min: number; total_min: number };
  plan_notes?: string;
  /** Three-field reflection (D-pending). */
  reflection?: { done?: string; unfinished?: string; next?: string };
  outcome: "completed" | "cancelled" | "rescued";
  started_at: ISODateTime;
  ended_at: ISODateTime;
  // Connected-only enrichment (copied from the Arel Focus result file):
  apps_used?: string[];
  websites_used?: string[];
  blocked_site_attempts?: string[];
  allowed_overrides?: string[];
}

export interface DailyFrontmatter extends BaseFrontmatter {
  type: "daily";
  /** YYYY-MM-DD (matches filename). */
  date: string;
  /** YYYY-Www. */
  week?: string;
  /** Morning check-in answers (D34). */
  morning?: DailyMorning;
  /** Q8 — 1–3 highlighted must-do tasks, starred from the Today board. */
  must_do?: Wikilink[];
  /** This week's focus quests, surfaced in the manifesto. */
  focus_quests?: Wikilink[];
  evening?: DailyEvening;
  /** Focus Sessions run today, appended on each session end (Ch12). */
  sessions?: FocusLog[];
}

// ── Weekly note (D9 / D39 — Weekly Review artifact) ──────────────────────────

/**
 * A planning-scoped recurring assignment (D39 Q2b). Marks that a task assigned to
 * `day` this week should repeat into next week's Plan phase. Lives on the weekly
 * note — it does NOT touch the task's own `repeat` rule (kept separate so a
 * per-week planning choice never masquerades as a permanent task property).
 */
export interface WeeklyRecurring {
  day: WeekDay;
  /** Task wikilink. */
  task: Wikilink;
}

/** Per-phase completion — all three true ⇒ "Week is planned" (D39). */
export interface WeeklyProgress {
  reflect?: boolean;
  maintain?: boolean;
  plan?: boolean;
}

export interface WeeklyFrontmatter extends BaseFrontmatter {
  type: "weekly";
  /** YYYY-Www (matches filename). */
  week: string;
  /** Monday of the week, YYYY-MM-DD. */
  date_start?: string;
  /** Sunday of the week, YYYY-MM-DD. */
  date_end?: string;
  /** Plan-phase focus quests, snapshotted (the live axis is `quest.focus`). */
  focus_quests?: Wikilink[];
  /** Reflect-phase wins (free text lines). */
  wins?: string[];
  /** Reflect-phase mistakes / learnings (D39 Q3) — distinct from open_threads. */
  learnings?: string[];
  open_threads?: string[];
  /** Plan-phase recurring day-assignments that pre-seed next week (D39 Q2b). */
  recurring?: WeeklyRecurring[];
  /** Per-phase completion; all three ⇒ terminal "Week is planned" state. */
  progress?: WeeklyProgress;
}

// ── Ideal Week (D9 — two block kinds, single file) ───────────────────────────

export type WeekDay =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type IdealWeekCategory =
  | "ritual"
  | "deep-work"
  | "admin"
  | "health"
  | "social"
  | "learning"
  | "recharge";

/** recurring → repeats every week (template); one-off → added for one week (D9). */
export type IdealWeekBlockKind = "recurring" | "one-off";

export interface IdealWeekBlock {
  id: string;
  kind: IdealWeekBlockKind;
  day: WeekDay;
  /** HH:MM. */
  start: string;
  /** HH:MM. */
  end: string;
  label: string;
  area?: AreaSlug;
  category: IdealWeekCategory;
  /** Optional Quest/Project/Task link (pre-fills a Focus Session). */
  link?: Wikilink;
  /** YYYY-Www — set on one-off blocks to scope them to a week. */
  week?: string;
}

export interface IdealWeekFrontmatter extends BaseFrontmatter {
  type: "ideal-week";
  version?: number;
  /** Grid window start, "HH:MM" (template-level, default "08:00"). */
  day_start?: string;
  /** Grid window end, "HH:MM" (template-level, default "23:00"). */
  day_end?: string;
  blocks: IdealWeekBlock[];
}

// ── Unions + parsed-document shape ───────────────────────────────────────────

export type AnyFrontmatter =
  | AreaFrontmatter
  | QuestFrontmatter
  | ProjectFrontmatter
  | TaskFrontmatter
  | PageFrontmatter
  | ResourceFrontmatter
  | DatabaseFrontmatter
  | InboxFrontmatter
  | DailyFrontmatter
  | WeeklyFrontmatter
  | IdealWeekFrontmatter;

/** A parsed vault document: its relative path, frontmatter, and markdown body. */
export interface VaultDoc<F extends BaseFrontmatter = AnyFrontmatter> {
  /** Path relative to the vault root, e.g. "tasks/buy-milk.md". */
  path: string;
  frontmatter: F;
  body: string;
}

/** One entry returned by a directory listing. */
export interface VaultListEntry {
  /** Path relative to the vault root. */
  path: string;
  type: "file" | "dir";
}
