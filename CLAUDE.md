# CLAUDE.md — Arel OS

Contributor guide for agents (and humans) working in this repository.

---

## What this is

Arel OS is a local-first, markdown-backed personal life operating system. Every
piece of data — areas, quests, projects, tasks, notes — is a plain `.md` file
with YAML frontmatter, stored in a "vault" folder on disk. The app is a UI over
that folder; there is no cloud database and no proprietary format.

It covers five core primitives (Area, Quest, Project, Task, Database) plus a
"knowing" layer (Pages, Library, Inbox) and a set of daily/weekly operating
rituals (morning check-in, focus sessions, evening review, weekly plan/reflect).

Distribution is via `npx arelos` (see `cli/`), which installs a local vault
server and the web UI as two `launchd`-managed background services on macOS.

---

## Architecture

```
arelos/
├── src/            ← React 19 + Vite SPA (the UI)
├── server/          ← Bun backend — file I/O over the markdown vault
│   ├── config.ts    ← resolves vault path + ports (config file / env overrides)
│   ├── io.ts         ← vault read/write primitives
│   ├── focus-bridge.ts
│   └── engine/       ← the optional AI "Engine" that runs Recipes (automations)
├── cli/              ← standalone npm package: installer + service manager (`arelos`)
├── templates/vault/   ← the empty vault scaffold copied on first install
└── scripts/
```

- **Frontend** talks to the local **vault server** (Bun, default port `5274`)
  over HTTP for all reads/writes. The vault itself is markdown + YAML
  frontmatter — the server never owns data beyond what's on disk.
- **Engine** (`server/engine/`) is optional, off by default, and only runs
  Recipes — scheduled or on-demand automations (e.g. syncing finance data,
  synthesizing a project snapshot) that call out to an LLM via the Vercel AI
  Gateway. No indexing, caching, or embedding infrastructure exists or should
  be added speculatively.
- **CLI** (`cli/`) is a separate published package (`npx arelos`) responsible
  for installing, updating, and managing the two background services. It is
  not built or tested via the root `package.json` scripts.

**No Convex. No Clerk. No Obsidian dependency** — the vault folder is the
backend; the React app is a UI over it (though the vault format is fully
Obsidian-compatible, since it's just markdown + `[[wikilinks]]`).

---

## Tech stack

| Technology | Role |
|------------|------|
| React 19 + Vite | Frontend SPA, HMR dev loop |
| TypeScript (strict) | Both `src/` and `server/` |
| Bun | Package manager, script runner, and the backend runtime |
| Tailwind v4 + shadcn/ui (base-nova) | UI foundation; tokens live in `src/index.css` via `@theme inline` |
| Plate (platejs v53) | Rich-text block editor, used for Pages only |
| Biome | Lint + format (replaces ESLint + Prettier) |
| Vitest | Unit + integration tests |
| Markdown + YAML frontmatter | Storage format — every vault document is a `.md` file |

---

## Conventions

- **shadcn/ui first.** All UI components — layouts, inputs, selects, dialogs,
  tables — should use shadcn primitives. Avoid raw HTML elements or bespoke
  components that shadcn already covers.
- **Plate via official patterns only.** Use Plate through its documented
  plugin composition and the shadcn Plate registry components. Avoid
  hand-rolled nodes or overriding Plate internals.
- **Design tokens live in CSS, not ad hoc classes.** `src/index.css` is the
  source of truth for color/spacing/radius tokens consumed via
  `@theme inline`. New tokens should be added there, not inlined per-component.
- **TypeScript strict everywhere.** Both the frontend (`tsconfig.app.json`)
  and the server (`server/tsconfig.json`) are typechecked independently.
- **No secrets committed.** Never commit `.env`, API keys, or credentials.
  `.env.example` documents the variables the Engine needs — copy it to `.env`
  locally and fill in values as needed.
- **Config is never hardcoded.** The vault path and both HTTP ports are
  resolved at runtime by `server/config.ts` from `~/.arelos/config.json` (or
  an `ARELOS_CONFIG_PATH` override), with environment variables
  (`ARELOS_VAULT_PATH`, `ARELOS_WEB_PORT`, `ARELOS_VAULT_PORT`) as escape
  hatches for local dev. Never assume a fixed port or path in new code —
  read it from config.

---

## Running locally

Install dependencies with Bun, then run the frontend and vault server as two
separate processes:

```
bun install
bun run dev        # Vite dev server (frontend), default port 1347
bun run server     # Bun vault server (file I/O backend), default port 5274
```

Both ports can be overridden via `ARELOS_WEB_PORT` / `ARELOS_VAULT_PORT`, or by
pointing `ARELOS_CONFIG_PATH` at a config file. By default the vault server
reads/writes a `vault/` folder relative to its working directory in dev
(`ARELOS_VAULT_PATH` overrides this).

Other useful scripts (see `package.json`):

```
bun run build              # tsc -b && vite build
bun run preview             # preview the production build
```

The `cli/` package is a separate workspace with its own `package.json`; build
and test it independently if working in that folder.

---

## Health checks

Run these before considering any change complete:

```
bunx tsc -b --noEmit              # typecheck frontend
bun run typecheck:server          # typecheck server (tsc -p server/tsconfig.json)
bun run check                     # Biome lint + format (--write)
bun run test:once                 # Vitest, run once (vitest run --passWithNoTests)
```

---

## Working style

- **Think before coding.** Surface tradeoffs before touching anything; if
  multiple valid interpretations exist, name them rather than guessing.
- **Simplicity first.** Write the minimum code that closes the task at hand —
  nothing speculative, nothing "for later."
- **Surgical changes.** Touch only what the task requires, and match the
  existing style in the file you're editing.
- **Verify before closing.** Define what "done" looks like before writing a
  line, and confirm it — for UI work, that means checking every affected
  screen/state actually renders as expected.
