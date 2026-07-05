/**
 * Frontmatter parse/serialize + wikilink helpers. Pure string transforms over
 * YAML — no filesystem. Browser-safe (used for display) and server-safe (used
 * by server/io.ts). Uses the isomorphic `yaml` package.
 */

import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

/** Captures the YAML between leading `---` fences and the body that follows. */
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export interface ParsedDocument {
  frontmatter: Record<string, unknown>;
  body: string;
}

/**
 * Split a raw `.md` file into frontmatter + body. A file with no frontmatter
 * fence yields an empty frontmatter object and the whole text as the body.
 */
export function parseDocument(raw: string): ParsedDocument {
  const normalized = raw.replace(/\r\n/g, "\n");
  const match = normalized.match(FRONTMATTER_RE);
  if (!match) {
    return { frontmatter: {}, body: normalized };
  }
  const parsed = parseYaml(match[1]) as unknown;
  const frontmatter =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  // Drop the single conventional blank-line separator between fence and body.
  const body = (match[2] ?? "").replace(/^\n/, "");
  return { frontmatter, body };
}

/**
 * Render frontmatter + body back into a `.md` file: a YAML block between `---`
 * fences, a blank line, then the body. Keys are written in insertion order.
 */
export function serializeDocument(frontmatter: Record<string, unknown>, body: string): string {
  const yaml = stringifyYaml(frontmatter).trimEnd();
  const cleanBody = body.replace(/^\n+/, "");
  return `---\n${yaml}\n---\n\n${cleanBody}`;
}

/**
 * Resolve the target stem of a wikilink: strips the `[[ ]]` fence and any
 * `|alias` display text. `"[[health|Health]]"` → `"health"`. Input may or may
 * not include the fences (frontmatter often stores bare `[[stem]]`).
 */
export function wikiTarget(link: string): string {
  const inner = link.trim().replace(/^\[\[/, "").replace(/\]\]$/, "");
  const [target] = inner.split("|");
  return (target ?? "").trim();
}

/** Wrap a stem into a frontmatter wikilink: `"health"` → `"[[health]]"`. */
export function toWikilink(stem: string): string {
  return `[[${stem}]]`;
}
