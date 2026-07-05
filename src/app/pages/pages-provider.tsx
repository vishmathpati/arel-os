"use client";

/**
 * PagesProvider — one whole-vault page list shared by the sidebar Pages tree,
 * the subpage sections, and the `[[` wikilink autocomplete (via WikilinkProvider).
 * Lives inside the router so wikilink clicks can navigate. Mounted in Layout.
 */

import { type UsePages, usePages } from "@/app/pages/use-pages";
import { WikilinkProvider } from "@/shared/components/editor/wikilink-store";
import { createContext, useContext } from "react";
import { useNavigate } from "react-router-dom";

const PagesContext = createContext<UsePages | null>(null);

export function PagesProvider({ children }: { children: React.ReactNode }) {
  const api = usePages();
  const navigate = useNavigate();
  const wikiPages = api.pages.map((p) => ({ slug: p.slug, title: p.title || p.slug }));

  return (
    <PagesContext.Provider value={api}>
      <WikilinkProvider pages={wikiPages} onOpen={(slug) => navigate(`/pages/${slug}`)}>
        {children}
      </WikilinkProvider>
    </PagesContext.Provider>
  );
}

export function usePagesContext(): UsePages {
  const ctx = useContext(PagesContext);
  if (!ctx) throw new Error("usePagesContext must be used within PagesProvider");
  return ctx;
}
