"use client";

/**
 * Wikilink context (Chapter 7). The Plate mention plugin is adapted into the
 * `[[page]]` wikilink: the editor lives in `shared`, but it needs the live list
 * of pages (for the `[[` autocomplete + title resolution) and a way to navigate
 * on click. Both are app concerns, so the app fills this provider and the
 * shared mention-node consumes it. `key` on a mention node IS the page slug.
 */

import { createContext, useContext } from "react";

export interface WikiPage {
  slug: string;
  title: string;
}

interface WikilinkContextValue {
  /** Every linkable page (slug + display title). */
  pages: WikiPage[];
  /** Resolve a slug to its current title, or undefined if unknown. */
  resolveTitle: (slug: string) => string | undefined;
  /** Navigate to a page by slug (clicking a wikilink). */
  open: (slug: string) => void;
}

const WikilinkContext = createContext<WikilinkContextValue>({
  pages: [],
  resolveTitle: () => undefined,
  open: () => {},
});

export function WikilinkProvider({
  pages,
  onOpen,
  children,
}: {
  pages: WikiPage[];
  onOpen: (slug: string) => void;
  children: React.ReactNode;
}) {
  const value: WikilinkContextValue = {
    pages,
    resolveTitle: (slug) => pages.find((p) => p.slug === slug)?.title,
    open: onOpen,
  };
  return <WikilinkContext.Provider value={value}>{children}</WikilinkContext.Provider>;
}

export function useWikilink(): WikilinkContextValue {
  return useContext(WikilinkContext);
}
