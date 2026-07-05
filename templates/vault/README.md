# Template Vault

This folder is a **markdown vault** — the data layer for a personal life-OS. It holds
nothing but plain markdown files with YAML frontmatter. There is no database, no
proprietary format, no lock-in: every note is a `.md` file you (or any app) can read,
edit, sync, or back up with ordinary tools.

An app can sit on top of this folder as a UI, but the folder itself is always the
source of truth. If the app disappears, your data doesn't — it's just files.

This vault is also fully **Obsidian-compatible** (standard markdown + YAML
frontmatter + `[[wikilinks]]`), so you can open it directly in Obsidian as a free
fallback or companion view.

---

## The five primitives

Everything in this vault is one of five kinds of thing. Each is a single markdown
file, and its `type:` frontmatter field says which it is.

- **Area** — a domain of life you maintain on an ongoing basis (health, finance,
  work, learning, …). Areas don't get "done"; they just get tended.
- **Quest** — a multi-project goal with a deadline. A quest groups several projects
  toward one outcome.
- **Project** — a concrete deliverable made of tasks. Projects belong to an area,
  and optionally to a quest.
- **Task** — a single, doable action. Tasks belong to an area, and optionally to a
  project.
- **Database** — a typed collection of rows (each row is its own markdown file with
  matching frontmatter columns) — used for structured data like accounts, cards,
  subscriptions, or contacts.

Everything else in the vault — pages, inbox captures, daily/weekly notes, system
config — supports these five without being a sixth kind of primitive.

---

## Folder map

```
template-vault/
├── areas/            one folder per Area, each with an _index.md
├── quests/           one folder per Quest
├── projects/         one folder per Project
├── tasks/            one .md file per Task
├── pages/            long-form notes and saved resources
├── inbox/            unsorted captures, waiting to be filed
├── databases/        typed collections (bank-accounts, cards, subscriptions,
│                     transactions, payments, contacts) — each with an _index.md
│                     schema and zero or more row files
└── system/
    ├── daily/            daily notes (YYYY-MM-DD.md)
    ├── weekly/           weekly notes (YYYY-Www.md)
    ├── summaries/        generated rollups
    ├── project-snapshots/ generated per-project dashboard snapshots
    ├── ideal-week.md     the recurring weekly schedule template
    └── recipes/          automations (see below)
```

---

## The one-area rule

Every item that belongs to an area (quest, project, task) names **exactly one**
home area in its frontmatter. An item is never split across two areas. If work
genuinely spans two domains, pick the area it belongs to *most*, or promote it to
its own area — don't multi-tag it. This keeps the vault navigable: you can always
answer "where does this live?" with one answer.

Areas themselves can nest one level deep via a `parent` field (a sub-area under a
top-level area), but the four starter areas in this template are all top-level.

---

## Markdown is truth

Nothing in this vault is real unless it's in a file. There's no hidden database, no
sync-only state, no server-side source of truth — if you can't find it by reading
the markdown, it doesn't exist. This means:

- You can grep, diff, and version-control the whole vault like any other text.
- Any tool that can read/write a `.md` file with YAML frontmatter can integrate with
  this vault — no special API required.
- Automations (see `system/recipes/`) read and write the same files a human would
  edit by hand. There is no separate "automation state."

---

## Recipes

`system/recipes/` holds automations — small, scoped jobs that read and write vault
files on a schedule or on demand (e.g. syncing finance data from email, or
rebuilding a project dashboard). See `system/recipes/context.md` for the shared
glossary every recipe run gets, `system/recipes/config.md` for model configuration,
and each recipe's own `SKILL.md` for what it does. Recipes ship disabled
(`enabled: false`) until you configure them for your own accounts and turn them on.
