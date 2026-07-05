/**
 * Design-token extractor — the deterministic design half of project-sync. Reads a
 * project's CSS (`:root` / dark selector / `@theme inline`) and the ```css fences
 * in its DESIGN.md, and returns a structured { light, dark, fonts, spacing, radius }
 * token set. Rebuilt from the archived `css-tokens.ts` contract (studied, NOT
 * copied). Pure parsing — no AI, no token generation (D63: "AI-extracting tokens"
 * is out of scope). Only CSS + DESIGN.md are read; never any code file.
 */

import { promises as fs } from "node:fs";
import { join } from "node:path";
import {
  type ColorToken,
  type DesignTokens,
  type FontFamilyToken,
  type ScaleToken,
  type TokenSource,
  emptyDesignTokens,
} from "../../src/shared/lib/project-dashboard/tokens.ts";

/** Where a project's global stylesheet commonly lives (first hit wins). */
const CSS_CANDIDATES = [
  "src/index.css",
  "src/app/globals.css",
  "app/globals.css",
  "frontend/src/index.css",
  "frontend/src/app/globals.css",
  "src/styles/globals.css",
  "src/styles/index.css",
  "styles/globals.css",
];

const DESIGN_MD_CANDIDATES = ["agents/DESIGN.md", "DESIGN.md"];

/** Dark-mode selectors, in order of likelihood. */
const DARK_SELECTORS = [".dark", ":root.dark", "html.dark", '[data-theme="dark"]'];

async function readFirst(repoPath: string, candidates: string[]): Promise<string | null> {
  for (const rel of candidates) {
    try {
      return await fs.readFile(join(repoPath, rel), "utf8");
    } catch {
      // try next
    }
  }
  return null;
}

/** Remove /* … *​/ block comments so selectors inside comments don't false-match. */
function stripBlockComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length));
}

/** Extract the body of `selector { … }`, brace-balanced. Null if not found. */
function extractBlock(css: string, selector: string): string | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:^|})\\s*${escaped}\\s*\\{`, "m");
  const m = re.exec(css);
  if (!m) return null;
  const open = m.index + m[0].length - 1; // index of the '{'
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  return null;
}

interface RawToken {
  name: string;
  value: string;
  comment?: string;
}

/** Parse `--name: value; /* comment *​/` declarations from a block body. */
function parseTokenLines(block: string): RawToken[] {
  const out: RawToken[] = [];
  const re = /--([\w-]+)\s*:\s*([^;]+);([^\n]*)/g;
  let m: RegExpExecArray | null = re.exec(block);
  while (m !== null) {
    const name = m[1].trim();
    const value = m[2].trim();
    const tail = m[3] ?? "";
    const c = tail.match(/\/\*\s*(.*?)\s*\*\//);
    out.push({ name, value, comment: c ? c[1] : undefined });
    m = re.exec(block);
  }
  return out;
}

function isColorLike(value: string): boolean {
  return /(#[0-9a-f]{3,8}\b|\b(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color-mix)\s*\(|\bvar\s*\()/i.test(
    value,
  );
}

function parsePixels(value: string): number | undefined {
  const px = value.match(/^(-?\d*\.?\d+)px$/);
  if (px) return Number(px[1]);
  const rem = value.match(/^(-?\d*\.?\d+)rem$/);
  if (rem) return Number(rem[1]) * 16;
  return undefined;
}

/** Resolve var(--x) references against a flat scope, up to 3 hops. */
function resolveValue(value: string, scope: Map<string, string>, depth = 0): string {
  if (depth > 3 || !value.includes("var(")) return value;
  const resolved = value.replace(/var\(\s*--([\w-]+)\s*(?:,[^)]*)?\)/g, (whole, name: string) => {
    const v = scope.get(name);
    return v !== undefined ? v : whole;
  });
  return resolved === value ? value : resolveValue(resolved, scope, depth + 1);
}

type Bucket = "color" | "family" | "scale" | "spacing" | "radius" | "other";

/** Classify a token by its name prefix (after the leading `--`). */
function classify(name: string, resolvedValue: string): Bucket {
  if (name.startsWith("font-")) return "family";
  if (name.startsWith("text-")) return "scale";
  if (name.startsWith("space")) return "spacing";
  if (name.startsWith("radius") || name.startsWith("rounded")) return "radius";
  if (isColorLike(resolvedValue)) return "color";
  return "other";
}

/** Strip a known category prefix for cleaner display (e.g. "font-sans" → "sans"). */
function shortName(name: string): string {
  return name.replace(/^(font|text|spacing|space|radius|rounded|color)-/, "");
}

interface DesignMdBuckets {
  light: RawToken[];
  dark: RawToken[];
  semantic: RawToken[];
}

/** Parse ```css fences from DESIGN.md, bucketed by the nearest heading (light default). */
function parseDesignMd(md: string): DesignMdBuckets {
  const buckets: DesignMdBuckets = { light: [], dark: [], semantic: [] };
  const lines = md.split("\n");
  let heading = "";
  let inFence = false;
  let fence: string[] = [];

  const flush = () => {
    const tokens = parseTokenLines(fence.join("\n"));
    const h = heading.toLowerCase();
    const target = /dark/.test(h)
      ? buckets.dark
      : /semantic|surface|status|accent/.test(h)
        ? buckets.semantic
        : buckets.light;
    target.push(...tokens);
    fence = [];
  };

  for (const line of lines) {
    const fenceOpen = /^```css\b/i.test(line.trim());
    const fenceClose = /^```\s*$/.test(line.trim());
    if (!inFence && /^#{1,4}\s/.test(line)) {
      heading = line.replace(/^#{1,4}\s/, "").trim();
    } else if (!inFence && fenceOpen) {
      inFence = true;
    } else if (inFence && fenceClose) {
      inFence = false;
      flush();
    } else if (inFence) {
      fence.push(line);
    }
  }
  return buckets;
}

/** De-dupe by name, keeping the first occurrence (primary source wins). */
function dedupeByName<T extends { name: string }>(tokens: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const t of tokens) {
    if (!t.name || seen.has(t.name)) continue;
    seen.add(t.name);
    out.push(t);
  }
  return out;
}

/**
 * Extract a project's design tokens from its CSS + DESIGN.md. Returns an empty set
 * (source "none") when neither is found — never throws.
 */
export async function extractDesignTokens(repoPath: string): Promise<DesignTokens> {
  const [cssRaw, designRaw] = await Promise.all([
    readFirst(repoPath, CSS_CANDIDATES),
    readFirst(repoPath, DESIGN_MD_CANDIDATES),
  ]);

  if (!cssRaw && !designRaw) return emptyDesignTokens();

  // ── CSS side ──
  const css = cssRaw ? stripBlockComments(cssRaw) : "";
  const rootRaw = css ? parseTokenLines(extractBlock(css, ":root") ?? "") : [];
  let darkRaw: RawToken[] = [];
  if (css) {
    for (const sel of DARK_SELECTORS) {
      const block = extractBlock(css, sel);
      if (block) {
        darkRaw = parseTokenLines(block);
        break;
      }
    }
  }
  const themeRaw = css ? parseTokenLines(extractBlock(css, "@theme inline") ?? "") : [];

  // Two scopes for var() resolution so a token defined in BOTH :root and the dark
  // selector resolves to the right value per mode: light uses :root (+ @theme),
  // dark layers the dark selector over :root.
  const lightScope = new Map<string, string>();
  for (const t of [...rootRaw, ...themeRaw]) lightScope.set(t.name, t.value);
  const darkScope = new Map<string, string>();
  for (const t of [...rootRaw, ...darkRaw, ...themeRaw]) darkScope.set(t.name, t.value);

  const lightColors: ColorToken[] = [];
  const darkColors: ColorToken[] = [];
  const families: FontFamilyToken[] = [];
  const scale: ScaleToken[] = [];
  const spacing: ScaleToken[] = [];
  const radius: ScaleToken[] = [];

  const intake = (tokens: RawToken[], colorTarget: ColorToken[], scope: Map<string, string>) => {
    for (const t of tokens) {
      const resolved = resolveValue(t.value, scope);
      const bucket = classify(t.name, resolved);
      if (bucket === "color") {
        colorTarget.push({ name: t.name, value: resolved, comment: t.comment });
      } else if (bucket === "family") {
        families.push({ name: shortName(t.name), value: resolved });
      } else if (bucket === "scale") {
        scale.push({ name: shortName(t.name), value: resolved, pixels: parsePixels(resolved) });
      } else if (bucket === "spacing") {
        spacing.push({ name: shortName(t.name), value: resolved, pixels: parsePixels(resolved) });
      } else if (bucket === "radius") {
        radius.push({ name: shortName(t.name), value: resolved, pixels: parsePixels(resolved) });
      }
    }
  };

  intake(rootRaw, lightColors, lightScope);
  intake(darkRaw, darkColors, darkScope);
  // @theme inline carries fonts/scale/spacing/radius (and color aliases we ignore here).
  for (const t of themeRaw) {
    const resolved = resolveValue(t.value, lightScope);
    const bucket = classify(t.name, resolved);
    if (bucket === "family") families.push({ name: shortName(t.name), value: resolved });
    else if (bucket === "scale")
      scale.push({ name: shortName(t.name), value: resolved, pixels: parsePixels(resolved) });
    else if (bucket === "spacing")
      spacing.push({ name: shortName(t.name), value: resolved, pixels: parsePixels(resolved) });
    else if (bucket === "radius")
      radius.push({ name: shortName(t.name), value: resolved, pixels: parsePixels(resolved) });
  }

  // ── DESIGN.md side (fills gaps only) ──
  const md = designRaw ? parseDesignMd(designRaw) : { light: [], dark: [], semantic: [] };
  const mdLight = [...md.light, ...md.semantic];
  for (const t of mdLight) {
    if (isColorLike(t.value))
      lightColors.push({ name: t.name, value: t.value, comment: t.comment });
  }
  for (const t of [...md.dark, ...md.semantic]) {
    if (isColorLike(t.value)) darkColors.push({ name: t.name, value: t.value, comment: t.comment });
  }

  const source: TokenSource =
    cssRaw && designRaw ? "merged" : cssRaw ? "css" : designRaw ? "design.md" : "none";

  const tokens: DesignTokens = {
    light: dedupeByName(lightColors),
    dark: dedupeByName(darkColors),
    fonts: {
      families: dedupeByName(families),
      scale: dedupeByName(scale),
    },
    spacing: dedupeByName(spacing),
    radius: dedupeByName(radius),
    source,
  };

  const hasAny =
    tokens.light.length ||
    tokens.dark.length ||
    tokens.fonts.families.length ||
    tokens.spacing.length ||
    tokens.radius.length;
  if (!hasAny) return emptyDesignTokens();

  return tokens;
}
