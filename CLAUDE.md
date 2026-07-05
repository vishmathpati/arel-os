# CLAUDE.md — Arel OS (Arel personal OS app)

## Coding Standards

**1. Think Before Coding** — Surface tradeoffs before touching anything. If there are multiple valid interpretations, name them and wait.
**2. Simplicity First** — Minimum code that closes the chapter. Nothing speculative, nothing for "later."
**3. Surgical Changes** — Touch only what the chapter requires. Match the existing style.
**4. Verify Before Closing** — Define done before writing a line. Screenshot every screen at every state before reporting complete.

---

## What this is

**Arel OS** (folder name) is Vish's greenfield personal life-OS app — the clean replacement for the old arel-workspace dashboard. It is a local-first, markdown-backed workspace covering the 5 Area/Quest/Project/Task/Database primitives plus the knowing layer (Pages, Library, Inbox) and all 5 operating-rhythm rituals.

Codename "Arel OS" = the app. Vault folder = `~/Arel OS/arel-workspace/` (TBD — storage paths finalized before Chapter 2). Dev port: **1347**. Production: TBD.

This is NOT a refactor of arel-workspace. Every feature is re-decided at its chapter Contract. The old app is a reference map only — keep its **contracts**, rebuild its **code**.

Reference project for workflow discipline and format: `~/Arel OS/Projects/Active/tcldb-v4`.

---

## Tier boundary — this is a code tier

`arelos` is a **code tier**. It owns all of its own coding **and its own project-protocol canon** (`agents/BRIEF.md` · `BRIEF-2.md` · `STATUS.md` · `ROADMAP.md` · `CHANGELOG.md` · `WORKLOG.md` · `DESIGN.md`). It does **not** decide ecosystem-wide matters.

- **Ecosystem / cross-product / recipe / governance decisions → bounce to the Arel Ecosystem root session.** A `SKILL.md` for a recipe, where recipes live, how products wire together, whole-ecosystem policy — none of that is decided here.
- **arelos receives contract-first build prompts from the ecosystem tier** and executes them via the chapter loop (Contract → Backend → UI → Verify → Close), writing its own BRIEF/STATUS/CHANGELOG/WORKLOG. When a build needs an ecosystem decision, surface it back up — don't decide it here.
- **The wall (inviolable):** the ecosystem tier never edits arelos canon or code; an arelos session never edits ecosystem canon or recipes. arelos builds the *tools, schema, and UI* a recipe depends on, to the contract it was handed; the recipe's `SKILL.md` is authored at the ecosystem tier.

(Mirrors the "Tier boundary — ecosystem vs. code" rule locked in the Arel Ecosystem root `CLAUDE.md`, 2026-06-23.)

---

## Tech stack

| Technology | Role |
|------------|------|
| React 19 + Vite | Frontend SPA, HMR dev loop |
| TypeScript strict | Contracts are the unit of work |
| Bun | Package manager + script runner |
| Tailwind v4 + shadcn/ui (base-nova) | UI foundation; `@theme inline` in `src/index.css` |
| Plate (platejs v53) | Rich-text block editor for Pages only |
| Biome | Lint + format (replaces ESLint + Prettier) |
| Vitest | Unit + integration tests |
| Bun backend (`arel-workspace/`) | File I/O server for markdown vault reads/writes |
| Markdown + YAML frontmatter | Storage — every document is a `.md` file |

**No Convex. No Clerk. No Obsidian dependency.** The vault folder is the backend; the React app is a UI over it.

---

## What NOT to do

**shadcn-FIRST — no exceptions.** shadcn/ui is the first and only choice for all UI components — layouts, inputs, selects, dialogs, tables, everything. Never use raw HTML elements or invent a component that shadcn already covers. **If shadcn does NOT have what you need → STOP and ask Vish.** Do not improvise.

**Plate via official patterns only.** Use Plate exclusively through its official examples, the shadcn Plate registry components, and documented plugin composition. Do NOT hand-roll custom nodes, override internals, or build editor features outside the Plate plugin API. That path is exactly what turned the previous Tiptap editor into a maintenance nightmare.

**Never copy old arel-workspace code.** The existing app at `~/Arel OS/Projects/Active/arel-workspace/` is a reference map — study its contracts and agree-ments (frontmatter shapes, Arel Focus bridge protocol, vault conventions). Rebuild every implementation fresh. Reuse is a per-chapter decision made with Vish at the Contract step; blanket copying is forbidden.

**Tokens flow from DESIGN.md.** Never edit `src/index.css` directly. If you need a new token, add it to `agents/DESIGN.md` first — then mirror to CSS. DESIGN.md is the single source of truth for all visual decisions.

**No premature AI or indexing.** Build zero indexing, caching, embedding, or AI automation until there is real, felt pain and Vish explicitly approves it. The prior build failed partly from building clever infrastructure instead of useful features.

**No git remotes, secrets, or API keys committed.** Git history is permanent. Never commit `.env`, API keys, or credentials — not even in a "private" repo.

**Do not re-litigate locked decisions.** The taxonomy (Area/Quest/Project/Task/Database), the storage model (markdown + frontmatter), the editor (Plate), the operating-rhythm rituals — all sealed in design. Refer to `agents/BRIEF.md` for the decision log. Propose amendments in discussion; never in a pull request.

**Discussion-default.** Conversation does not edit files unless Vish says "go" or names a specific change. When Vish says "let's discuss," just talk — do not present option menus or push to a decision.

---

## Three-folder layout

```
arelos/
├── CLAUDE.md          ← this file (always loaded)
├── README.md          ← file-and-dependency map (when you change X, what else goes stale)
├── agents/            ← project canon — Claude Code reads this at session start
│   ├── STATUS.md      ← current chapter state + next actions
│   ├── BRIEF.md       ← locked decisions, versioned, append-only
│   ├── ROADMAP.md     ← act/chapter sequence with Definitions of Done
│   ├── BRAND.md       ← product identity and visual direction
│   ├── FUNDAMENTALS.md ← universal UI principles (read before any UI work)
│   ├── DESIGN.md      ← design tokens (being written by parallel agent)
│   ├── TOOLING.md     ← bun, Node 24, Biome, Vitest, ports
│   ├── DISCOVERIES.md ← per-session findings, format-ready
│   ├── WORKLOG.md     ← real-time session log (cleared by save-session)
│   └── CHANGELOG.md   ← append-only history (Keep a Changelog format)
├── cowork/            ← orchestration tier (light; Claude Code runs both roles here)
│   ├── STATUS.md
│   ├── BRIEF.md
│   └── DECISIONS-TRAIL.md
├── human/             ← Vish's daily steering
│   └── AGENDA.md
└── src/, public/, …   ← app code (never edited by protocol instructions)
```

**Who reads what:**
- **Claude Code** owns `agents/` and reads it at every session start. Reads `cowork/` for cross-cutting context when needed.
- **Vish** reads `human/AGENDA.md` — open it, find the next un-ticked chapter, do the work.
- **Everyone** loads root `CLAUDE.md` first.

Because this is a small, single-tool project (no Codex split, no Cowork agent), Claude Code handles all phases: Contract discussion, backend, UI, and verification. Vish is at Contract + Verify.

---

## Pre-task classification (mandatory before any code change)

1. **NEW standalone feature** — completely new capability. Add to `agents/ROADMAP.md` if not already listed.
2. **ADDITION to existing feature** — extending something already built. Re-read its chapter section in ROADMAP + BRIEF before touching it.
3. **UI CHANGE** — visual or behavioral. Read `agents/DESIGN.md` + `agents/FUNDAMENTALS.md` first.
4. **BUG FIX** — broken behavior. Identify the owning chapter and re-read its DoD before fixing.

---

## The chapter loop (all inside Claude Code)

Every chapter follows this sequence. No exceptions, no shortcuts.

1. **Contract** — Vish + Claude Code discuss and lock: what we're building, the markdown/frontmatter shape, the UI contract (which shadcn components, which states, what data flows where). Nothing is built until the contract is explicit.
2. **Backend** — Bun file-I/O layer: read/write functions, frontmatter schemas, any vault path decisions for this chapter.
3. **UI** — React components built from shadcn primitives and Plate, wired to the backend. All states handled: empty, loading, error, full, CRUD confirmation.
4. **Verify** — Screenshots at every screen size. Every state exercised. Design-check skill run. CRUD confirmed to work. Matches DESIGN.md exactly. Vish gives the go-ahead.
5. **Close** — CHANGELOG append, STATUS update, WORKLOG entry, AGENDA tick.

**Design-check gate:** Before closing any UI step, run `project-protocol:design-check`. Screenshots are the evidence of record. "Wired to data" is not done — the screen must match DESIGN.md / FUNDAMENTALS.md at every state.

**Flagship-page-first (sealed rule):** The Task page is built first, in Chapter 3, to a level of perfection Vish signs off on. It becomes the locked visual reference that every subsequent page copies. Consistency comes from this, not from per-page improvisation.

---

## Session rules

- Pre-task classification before any code change.
- Worklog discipline: every change, bug, or decision appends one line to `agents/WORKLOG.md` in real-time.
- Before closing any phase: check for stale protocol files (see `README.md`).
- Run `save-session` before closing. Update `agents/STATUS.md` and `agents/CHANGELOG.md`.
- Re-derive `human/AGENDA.md` when a chapter ships or the roadmap changes.

---

## Reference files (outside this repo)

- `~/Arel OS/Projects/Active/arel-workspace/` — existing app (reference contracts only; never copied)
- `~/Arel OS/Projects/Active/tcldb-v4/` — workflow discipline reference (chapter loop format, BRIEF style, verify/close rigor)
- `~/Arel OS/arel-workspace/` — markdown vault DATA folder (finalized at Chapter 2; pure data, uncommitted). Server CODE lives in `arelos/server/` (Bun, port 5274).
- Memory files at `~/.claude/projects/-Users-vishmathpati-Arel-OS-Projects-Active-arel-workspace/memory/` — sealed design decisions (quest-taxonomy-model, operating-rhythm, content-knowing-layer, build-stack-decisions, build-workflow-discipline, existing-app-reference)

## Health checks

- typecheck (frontend): `bunx tsc -b --noEmit`
- typecheck (server): `bun run typecheck:server`
- lint/format: `bun run check`
- test: `bun run test:once`
