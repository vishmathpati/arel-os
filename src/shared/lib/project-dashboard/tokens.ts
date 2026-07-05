/**
 * Design-token shapes shared by the Engine's `design-tokens` tool (which parses a
 * software project's CSS + DESIGN.md and produces these) and the Design/Feel tab
 * (which renders them). Browser-safe: pure types, no runtime, no file paths.
 *
 * The parse is deterministic and never sent to the AI (D63 contract) — these
 * tokens are extracted in code, server-side, in `server/engine/design-tokens.ts`.
 */

/** A color custom-property: `--name: value;` with its trailing `/* comment *​/` if any. */
export interface ColorToken {
  name: string;
  value: string;
  comment?: string;
}

/** A `--font-*` family declaration. */
export interface FontFamilyToken {
  name: string;
  value: string;
}

/** A sized token (`--text-*`, `--spacing-*`, `--radius-*`); `pixels` parsed from px/rem. */
export interface ScaleToken {
  name: string;
  value: string;
  pixels?: number;
}

/** Where the tokens came from — surfaced as a quiet caption, never a raw file path. */
export type TokenSource = "design.md" | "css" | "merged" | "none";

/**
 * The full extracted design system of a project: light + dark color tokens, the
 * type system (families + size scale), spacing and radius scales. Mirrors the
 * archived `css-tokens.ts` output contract (studied, not copied), minus the raw
 * file-path fields (no-technical-data).
 */
export interface DesignTokens {
  light: ColorToken[];
  dark: ColorToken[];
  fonts: {
    families: FontFamilyToken[];
    scale: ScaleToken[];
  };
  spacing: ScaleToken[];
  radius: ScaleToken[];
  source: TokenSource;
}

/** An empty token set — the "no design system found" fallback. */
export function emptyDesignTokens(): DesignTokens {
  return {
    light: [],
    dark: [],
    fonts: { families: [], scale: [] },
    spacing: [],
    radius: [],
    source: "none",
  };
}
