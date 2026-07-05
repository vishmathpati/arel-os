"use client";

/**
 * AreasProvider — one whole-vault area list shared by the sidebar AreasNav,
 * every area picker (task/project/quest/habit/database/ideal-week dialogs),
 * and the Areas index page. Mirrors PagesProvider. Mounted in Layout so a
 * create/rename/archive anywhere reloads every consumer via the same state.
 */

import { type UseAreas, useAreas } from "@/app/areas/use-areas";
import { createContext, useContext } from "react";

const AreasContext = createContext<UseAreas | null>(null);

export function AreasProvider({ children }: { children: React.ReactNode }) {
  const api = useAreas();
  return <AreasContext.Provider value={api}>{children}</AreasContext.Provider>;
}

export function useAreasContext(): UseAreas {
  const ctx = useContext(AreasContext);
  if (!ctx) throw new Error("useAreasContext must be used within AreasProvider");
  return ctx;
}
