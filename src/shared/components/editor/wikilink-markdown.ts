/**
 * Wikilink markdown round-trip (Chapter 7) — keeps `[[slug]]` in the `.md` body
 * while rendering as a Plate mention node in the editor. Both directions use
 * documented `@platejs/markdown` extension points only (a remark plugin on the
 * mdast + custom conversion `rules`); nothing patches Plate internals.
 *
 * - Deserialize (md -> Plate): `remarkWikilink` splits `[[slug]]` out of text
 *   nodes into a `wikilink` mdast node; the `wikilink` rule maps it to a mention.
 * - Serialize (Plate -> md): the mention rule emits a raw `html` mdast node
 *   `[[slug]]`, which remark-stringify writes verbatim (no bracket escaping).
 */

import { KEYS } from "platejs";

/** `[[slug]]` — slug is everything up to the closing brackets. */
const WIKILINK_RE = /\[\[([^\]]+?)\]\]/g;

interface MdNode {
  type: string;
  value?: string;
  slug?: string;
  children?: MdNode[];
  [key: string]: unknown;
}

/** Split one text node into text + `wikilink` nodes around each `[[slug]]`. */
function splitTextNode(node: MdNode): MdNode[] {
  const value = node.value ?? "";
  const out: MdNode[] = [];
  let last = 0;
  WIKILINK_RE.lastIndex = 0;
  let match: RegExpExecArray | null = WIKILINK_RE.exec(value);
  while (match !== null) {
    if (match.index > last) {
      out.push({ type: "text", value: value.slice(last, match.index) });
    }
    out.push({ type: "wikilink", slug: match[1].trim() });
    last = match.index + match[0].length;
    match = WIKILINK_RE.exec(value);
  }
  if (out.length === 0) return [node];
  if (last < value.length) out.push({ type: "text", value: value.slice(last) });
  return out;
}

/** Recursively rewrite `[[slug]]` occurrences into `wikilink` nodes. */
function transform(node: MdNode): void {
  if (!node.children) return;
  const next: MdNode[] = [];
  for (const child of node.children) {
    if (child.type === "text" && typeof child.value === "string" && child.value.includes("[[")) {
      next.push(...splitTextNode(child));
    } else {
      transform(child);
      next.push(child);
    }
  }
  node.children = next;
}

/** Remark plugin: convert `[[slug]]` text into `wikilink` mdast nodes. */
export function remarkWikilink() {
  return (tree: MdNode) => {
    transform(tree);
  };
}

/**
 * `@platejs/markdown` conversion rules for the wikilink <-> mention bridge.
 * Keyed by mdast type (`wikilink`, deserialize) and Plate type (mention,
 * serialize).
 */
export const wikilinkRules = {
  wikilink: {
    deserialize: (mdastNode: MdNode) => ({
      type: KEYS.mention,
      key: mdastNode.slug ?? "",
      value: mdastNode.slug ?? "",
      children: [{ text: "" }],
    }),
  },
  [KEYS.mention]: {
    serialize: (node: { key?: string; value?: string }): MdNode => ({
      type: "html",
      value: `[[${node.key ?? node.value ?? ""}]]`,
    }),
  },
};
