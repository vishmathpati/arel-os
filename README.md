# README — Arel OS file map

This file answers one question: **"I just changed X. What else is now stale?"**

It covers protocol/canon markdown only. Code dependencies are tracked in `agents/ROADMAP.md` per chapter. Generated files (`dist/`, `node_modules/`, `bun.lock`) are out of scope.

---

## Folder layout at a glance

```
arelos/
├── CLAUDE.md                 ← always-loaded protocol (every session reads this first)
├── README.md                 ← this file (markdown dependency map)
│
├── agents/                   ← project canon (Claude Code reads at session start)
│   ├── STATUS.md             ← current chapter state, known issues, next actions
│   ├── BRIEF.md              ← locked decisions (versioned, append-only)
│   ├── ROADMAP.md            ← acts + chapters with DoD
│   ├── BRAND.md              ← product identity and visual direction
│   ├── FUNDAMENTALS.md       ← universal UI principles
│   ├── DESIGN.md             ← design tokens (written by parallel agent; source of truth)
│   ├── TOOLING.md            ← bun, Node 24, Biome, Vitest, ports
│   ├── DISCOVERIES.md        ← per-session findings
│   ├── WORKLOG.md            ← real-time session log (cleared by save-session)
│   └── CHANGELOG.md          ← append-only history
│
├── cowork/                   ← orchestration tier (light)
│   ├── STATUS.md
│   ├── BRIEF.md
│   └── DECISIONS-TRAIL.md
│
└── human/
    └── AGENDA.md             ← Vish's steering — which chapter, what next
```

---

## When you change one of these, what becomes stale?

### Always-loaded files

**`CLAUDE.md`** — if you change folder layout, rules, or reference file paths:
- Update `README.md` (this file) to match
- Update `cowork/BRIEF.md` if an operating rule changed
- Check `agents/STATUS.md` Next Actions still make sense
- Re-derive `human/AGENDA.md` if the chapter loop or role split changed

**`README.md`** (this file) — if you add/remove/rename a markdown file:
- Update `CLAUDE.md` if the file is referenced there (Extended Context, three-folder layout)

### Agent tier

**`agents/STATUS.md`** — refresh on every save-session. No downstream stale files.

**`agents/BRIEF.md`** — when you append a new version block:
- Add a row to `cowork/DECISIONS-TRAIL.md`
- If the decision affects scope or chapter order, update `agents/ROADMAP.md`
- If it changes UI rules, update `agents/FUNDAMENTALS.md` or `agents/DESIGN.md`
- Re-derive `human/AGENDA.md` if chapter order shifts

**`agents/ROADMAP.md`** — when chapter order, scope, or DoD changes:
- Update `agents/BRIEF.md` (new vN entry — decisions are locked, not just described)
- Re-derive `human/AGENDA.md`
- If the chapter loop steps change, update root `CLAUDE.md` "chapter loop" section

**`agents/BRAND.md`** — when product scope or visual direction changes:
- Update `agents/BRIEF.md` (new vN entry)
- Update `agents/DESIGN.md` if palette or typography intent shifts
- Check `agents/STATUS.md` Next Actions

**`agents/FUNDAMENTALS.md`** — if universal UI principles change:
- Update `agents/DESIGN.md` if tokens or layout contracts shift
- Check `agents/STATUS.md` Next Actions

**`agents/DESIGN.md`** — if tokens, colors, or spacing change:
- `src/index.css` needs a corresponding update (tokens mirror to CSS)
- Audit any in-flight UI work in the current chapter against the new tokens
- Note the change in `agents/WORKLOG.md`

**`agents/TOOLING.md`** — if bun, Node, Biome, or port changes:
- Update `CLAUDE.md` "Health checks" if commands changed
- Update `agents/STATUS.md` if a new tool was added

**`agents/DISCOVERIES.md`** — when a finding flips a decision:
- Update `agents/BRIEF.md` (new vN entry)
- Update the relevant chapter section in `agents/ROADMAP.md`

**`agents/WORKLOG.md`** — cleared by save-session. No downstream stale files.

**`agents/CHANGELOG.md`** — append-only. No downstream stale files.

### Cowork tier

**`cowork/BRIEF.md`** — if an orchestration-level decision locks:
- Add a row to `cowork/DECISIONS-TRAIL.md`
- If the decision affects agents, summarize in `agents/BRIEF.md` (link back; don't duplicate)

**`cowork/STATUS.md`** — refresh on every save-session. No downstream stale files.

**`cowork/DECISIONS-TRAIL.md`** — append-only. New entries go at the bottom.

### Human tier

**`human/AGENDA.md`** — re-derived by Claude Code when:
- A chapter ships
- `agents/ROADMAP.md` changes
- A chapter's DoD or sub-step order changes

This file is downstream of everything else. Nothing gets updated *because* AGENDA changed.

---

## How to use this map

1. Before editing any protocol markdown file, find its row above.
2. Make your edit.
3. Walk the bullet list. Update every file listed before closing the session.
4. Append the edit to `agents/WORKLOG.md`.
5. Run `save-session` at end of session.

If the file you changed is not listed above, it is not protocol canon — this map does not apply.

---

## What this map deliberately does NOT cover

- Code-side dependencies (tracked in each chapter's section of `agents/ROADMAP.md`)
- `node_modules/`, `dist/`, `bun.lock`, `.git/`, `public/`
- Per-file implementation details (captured in `agents/DISCOVERIES.md` and `agents/WORKLOG.md`)
