import { BaseFootnoteDefinitionPlugin, BaseFootnoteReferencePlugin } from "@platejs/footnote";
import { MarkdownPlugin, remarkMdx } from "@platejs/markdown";
import remarkEmoji from "remark-emoji";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { Plugin } from "unified";

import { remarkWikilink, wikilinkRules } from "@/shared/components/editor/wikilink-markdown";

// `[[slug]]` wikilinks replace the default `[text](mention:id)` mention syntax
// (Chapter 7, D29). `remarkWikilink` parses `[[slug]]` into mention nodes;
// `wikilinkRules` serialize them back to `[[slug]]`. See `wikilink-markdown`.
export const MarkdownKit = [
  BaseFootnoteReferencePlugin,
  BaseFootnoteDefinitionPlugin,
  MarkdownPlugin.configure({
    options: {
      rules: wikilinkRules,
      remarkPlugins: [
        remarkMath,
        remarkGfm,
        remarkEmoji as Plugin,
        remarkMdx,
        remarkWikilink as unknown as Plugin,
      ],
    },
  }),
];
