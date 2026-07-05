# Arel OS

A local-first, markdown-backed personal life operating system.

## Why

Your life doesn't belong in someone else's database. Arel OS stores everything —
areas, quests, projects, tasks, notes — as plain markdown files with YAML
frontmatter, sitting in a folder on your own machine. There's no cloud account
to lose access to and no proprietary format to get locked into. The app is just
a UI over your files. If it ever disappears, your data doesn't — open the same
folder in Obsidian, or a text editor, and it's all still there. Yours forever.

## Install

```
npx arelos
```

One command. It's interactive — it'll ask what to call your system, where to
install it, and which ports to use, then get out of your way.

Requirements: macOS only for v1. Nothing needs to be preinstalled — if Bun
isn't already on your machine, the installer installs it for you.

The core app needs zero API keys and works fully offline from the first run.

## What you get

- **Areas** — the domains of life you maintain on an ongoing basis, like health, finance, or work.
- **Quests** — multi-project goals with a deadline, grouping several projects toward one outcome.
- **Projects** — concrete deliverables made of tasks, each belonging to an area.
- **Tasks** — the single, doable actions that make up your day.
- **Databases** — typed collections of your own data, like accounts, subscriptions, or contacts.
- **Pages** — long-form notes and saved resources, written in a full block editor.
- **Inbox** — one place to capture anything before it's filed into its proper home.
- **Library** — a browsable view over everything you've saved and organized.
- **Daily rituals** — morning check-in, focus sessions, evening review, and a weekly plan/reflect cycle to run your days.
- **Finance OS** *(optional)* — pre-built databases for accounts, cards, subscriptions, and transactions.
- **Recipes** *(optional, off by default)* — a built-in AI Engine that runs automations on a schedule, like syncing your finances from Gmail.

## After install

```
rlo status      # is it running, and where
rlo update      # pull the latest version
rlo logs        # tail the service logs
rlo uninstall   # remove it cleanly
```

Two `launchd` services keep the app and its vault server running in the
background, so it's always there at `localhost` — no terminal window to babysit.

## Philosophy

- **Markdown is truth.** If it's not in a file, it doesn't exist. No hidden
  database, no sync-only state.
- **One home per item.** Every task, project, or quest lives in exactly one
  area. No multi-tagging, no ambiguity about where something belongs.
- **No lock-in.** Your vault is standard markdown with YAML frontmatter and
  `[[wikilinks]]` — fully Obsidian-compatible. Open it there any time, with or
  without Arel OS running.

## Optional companions

These are separate installs that pair with Arel OS but aren't required by it. All three are coming soon as separate releases for v1.

- **Arel Clipper** — a browser extension for capturing pages straight to your inbox.
- **Arel Focus** — a focus-timer that talks to your Focus Sessions.
- **Arel Blocker** — blocks distracting sites during a Focus Session.

## License

MIT
