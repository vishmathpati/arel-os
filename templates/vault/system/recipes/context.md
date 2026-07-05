# Vault glossary

Shared context injected into every recipe run. The vault is a folder of markdown files (each with YAML frontmatter) at the vault root. All tool paths are RELATIVE to that root.

Primitives (the `type` frontmatter field marks which):
- **Area** — a domain of life (health, finance, work, …). Lives at `areas/<slug>/_index.md`.
- **Quest** — a multi-project goal. `quests/<slug>/<slug>.md`.
- **Project** — a concrete deliverable with tasks. `projects/<slug>/<slug>.md`.
- **Task** — a single action. `tasks/<slug>.md`. Items name their home `area` in frontmatter.
- **Database** — a typed collection. `databases/<slug>/_index.md`.
- **Page** — a long-form note. `pages/<slug>.md`.
- **Inbox** — unsorted captures. `inbox/<id>.md`.

Conventions: one item = one markdown file; frontmatter carries `type`, `area`, `created`, `updated`. Links between items use wikilinks like `[[slug]]`. Create new files with the `vault-write` tool using a vault-relative path; it stamps timestamps and creates folders for you.
