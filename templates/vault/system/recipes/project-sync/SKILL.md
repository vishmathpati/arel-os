---
name: project-sync
description: Rebuild the software-project dashboards. For each kind:software project that has a linked repo_path, read its project-protocol markdown and design tokens and write one fresh ProjectSnapshot to system/project-snapshots/<slug>.md for the dashboard to render. Runs nightly at 22:00 and on demand (Run one / Run all). One-way and read-only — it never writes to a repo and never reads code, only the named protocol docs plus a single CSS/DESIGN.md token parse. Skips the model entirely when a project hasn't changed since its last sync.
allowed-tools: vault-read, vault-list, vault-write, project-read, design-tokens
trigger: scheduled
schedule: "0 22 * * *"
---

# project-sync

Keep every software project's dashboard current from its own project-protocol notes. The dashboard the user opens is only ever as fresh as the **snapshot** you write here — the app reads the snapshot, never the repo. So your job is to turn a project's raw protocol markdown into one clean, structured snapshot per project.

Prime directive: **read-only and one-way.** You read a linked project's protocol docs and write a snapshot into the vault. You never write into a repo, never read code, and when a project hasn't changed since its last sync you **don't synthesize at all** — you just bump the timestamp. Re-synthesizing an unchanged project burns tokens and lets the dashboard drift from a snapshot that was already correct.

## Tools

- **`project-read {repo_path, prior_manifest?}`** — reads a fixed allowlist of protocol docs (STATUS / BRIEF / ROADMAP / CHANGELOG / WORKLOG / DESIGN / DISCOVERIES / BRAND / CLAUDE / INDEX) from a linked repo and fingerprints each file (sha256). This is the only thing that touches a repo, and it only ever reads those named docs — never code. Returns `{ status, unchanged, manifest, files, changed, contents }`.
- **`design-tokens {repo_path}`** — parses the project's CSS (`:root` / dark selector / `@theme inline`) and its DESIGN.md ```css fences into `{ light, dark, fonts, spacing, radius, source }`. Deterministic — use its output **verbatim**, never hand-edit tokens.
- **`vault-read` / `vault-list` / `vault-write`** — vault I/O.

## 1. Decide what to sync

The task input is either a single project slug or empty.

- **A slug** → sync just that one project. `vault-read projects/<slug>/<slug>.md` to read its frontmatter and get `repo_path`.
- **Empty** → sync every linked software project. `vault-list projects` for the subfolders; for each `<slug>`, `vault-read projects/<slug>/<slug>.md` and keep only those whose frontmatter has `kind: software` **and** a non-empty `repo_path`. Silently skip the rest — a project without a `repo_path` simply isn't linked yet (log one line saying so).

## 2. Sync one project

For each target `<slug>` and its `repo_path`:

**a. Load the prior snapshot.** `vault-read system/project-snapshots/<slug>.md` if it exists, parse the ```json block, and keep its `manifest` array — that array is how `project-read` detects what changed. On a first-ever sync there's no prior file; that's fine, pass no `prior_manifest`.

**b. Read the protocol and branch.** Call `project-read {repo_path, prior_manifest}`. Act on the result:

- **`status` is `"folder-missing"`** — the linked folder was moved or renamed. Do **not** synthesize. Re-write the existing snapshot unchanged except set `meta.repoPresent: false` (this is what makes the dashboard show "Folder missing"). Then create a relink task at `tasks/relink-<slug>.md` — frontmatter `type: task`, `status: todo`, `area` copied from the project (or `learning` if unknown), `title: "Relink <project title> — folder moved"`; body: a sentence saying the saved `repo_path` no longer resolves and to re-link the folder from the project page. Log the project and move on.
- **`unchanged` is `true`** — nothing changed since the last sync. Do **not** synthesize. Re-write the prior snapshot with only `meta.syncedAt` updated to now (keep everything else byte-for-byte). Log "unchanged" and move on. This is the common nightly path and the entire reason the manifest exists — protect it.
- **otherwise** (something changed, or there was no prior snapshot) — synthesize a fresh snapshot, step **c**.

**c. Extract tokens, then synthesize.** Call `design-tokens {repo_path}`. Then build the full `ProjectSnapshot` (shape below) from the **full markdown in `project-read`'s `contents`** — every protocol file it returned — and `vault-write` it to `system/project-snapshots/<slug>.md`:

- frontmatter: `type: project-snapshot`, `project: <slug>`, `syncedAt: <ISO now>`
- body: a single fenced ```json block holding the snapshot object and nothing else.

**d. Log** one line (format at the bottom).

## The ProjectSnapshot shape

Emit exactly this structure as valid JSON. Three fields are **copied verbatim from the tools — never author or "improve" them**: `manifest` and `files` (straight from `project-read`) and `designFeel.tokens` (straight from `design-tokens`). You author everything else, drawing **only** on the protocol docs.

Annotated template (the `/* … */` notes are guidance — emit clean JSON without them):

```json
{
  "meta":     { "project": "<slug>", "syncedAt": "<ISO now>", "state": "healthy|watch|blocked|unknown", "repoPresent": true },
  "manifest": [ /* VERBATIM from project-read.manifest — {path, sha256, mtime, bytes} */ ],
  "overview": {
    "headline": "one sentence: where this project stands right now",
    "state":    "healthy|watch|blocked|unknown",
    "current":  "what is actively happening now (one line)",
    "recent":   [ { "title": "...", "detail": "..." } ],
    "next":     [ { "title": "...", "detail": "..." } ],
    "blocked":  [ { "title": "...", "detail": "..." } ]
  },
  "whatChanged": [ { "version": "", "date": "", "items": ["..."] } ],
  "roadmap":     [ { "phase": "...", "status": "done|active|next|later", "detail": "", "items": ["..."] } ],
  "decisions":   [ { "title": "...", "decided": "", "rejected": "", "why": "" } ],
  "structure": {
    "layers":   ["top-to-bottom architecture layers, e.g. React SPA, Bun server, markdown vault"],
    "folders":  [ { "name": "src/app", "role": "what this folder is responsible for" } ],
    "dataFlow": [ { "from": "UI", "to": "vault", "label": "reads/writes markdown" } ]
  },
  "designFeel": {
    "stack":     [ { "name": "React 19", "role": "frontend" } ],
    "brand":     { "name": "", "tagline": "", "audience": "", "problem": "" },
    "tokens":    { /* VERBATIM from design-tokens — {light, dark, fonts, spacing, radius, source} */ },
    "direction": "the design direction in plain prose (from DESIGN.md)",
    "principles":["..."]
  },
  "files": [ /* VERBATIM from project-read.files — {path, title, category, bytes, lines} */ ]
}
```

Where to source each authored field:

- **overview** ← STATUS.md (current state, what's next, blockers) plus recent WORKLOG / CHANGELOG activity. `state` is your honest read of how the project is doing.
- **whatChanged** ← CHANGELOG. On a re-sync, lead with what actually changed since the prior snapshot — that's the most useful thing on the page.
- **roadmap** ← ROADMAP.md, as phases marked done / active / next / later.
- **decisions** ← BRIEF / BRIEF-2 locked decisions. Favor decisions that *changed direction* and what they rippled into, not a flat dump.
- **structure** ← CLAUDE.md / README / INDEX. An architecture *map* — layers, what each folder does, how data flows — not a raw file tree.
- **designFeel** stack / brand / direction / principles ← DESIGN.md, BRAND.md, BRIEF tech tables. `tokens` come from the tool, untouched.

## Don't invent

If the docs don't support a field, leave it empty (`""` or `[]`). A blank field is honest; a guessed one corrupts the dashboard. Prefer plain product language over protocol jargon. One project = one snapshot file.

## Log

Append exactly one line per project per run to `log.md`:

```
[YYYY-MM-DD HH:MM] ok      · trigger=<launchd|ui|chat> · model=<slug> · <duration> · <tokens> · synced "<slug>" (rebuilt | unchanged | folder-missing→relink)
```

On failure, log `FAILED` with the error text and which project, e.g.:

```
[YYYY-MM-DD HH:MM] FAILED  · trigger=ui · model=<slug> · <duration> · "heightv2": project-read blocked (folder not linked)
```

A bare "ok/failed" with no project name or reason can't be debugged — be specific.
