"use client";

import { MentionInputPlugin, MentionPlugin } from "@platejs/mention/react";

import { MentionElement, MentionInputElement } from "@/shared/components/ui/mention-node";

/**
 * Adapted into the `[[page]]` wikilink (Chapter 7, D29). Trigger fires on the
 * SECOND `[` — `trigger: '['` + `triggerPreviousCharPattern: /\[$/` — so typing
 * `[[` opens the page picker. The stray leading `[` is cleaned up on select in
 * `mention-node`. Markdown round-trips to `[[slug]]` via `wikilink-markdown`.
 */
export const MentionKit = [
  MentionPlugin.configure({
    options: {
      trigger: "[",
      triggerPreviousCharPattern: /\[$/,
    },
  }).withComponent(MentionElement),
  MentionInputPlugin.withComponent(MentionInputElement),
];
