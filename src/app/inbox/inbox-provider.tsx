/**
 * InboxProvider — the single source of truth for the universal parking lot
 * (Chapter 9, D32). It owns the inbox item list + mutations, the global ⌘N
 * quick-capture dialog, and the sidebar count badge. Mounted once in the Layout
 * so capture works from anywhere and the badge stays live. The Inbox page is a
 * consumer of this context, not a separate loader — one state, no drift.
 */

import { QuickCapture } from "@/app/inbox/quick-capture";
import {
  type FileDestination,
  type InboxItem,
  captureInbox,
  discardInbox,
  fileInbox,
  listInbox,
  updateInbox,
} from "@/shared/lib/inbox-data";
import type { InboxFrontmatter } from "@/shared/lib/vault/schemas";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { toast } from "sonner";

interface InboxContextValue {
  items: InboxItem[];
  loading: boolean;
  error: string | null;
  /** Un-triaged count — drives the sidebar badge. */
  count: number;
  reload: () => void;
  patch: (item: InboxItem, patch: Partial<InboxFrontmatter>) => Promise<void>;
  file: (item: InboxItem, dest: FileDestination) => Promise<void>;
  discard: (item: InboxItem) => Promise<void>;
  capture: (raw: string) => Promise<InboxItem | null>;
  openCapture: () => void;
  captureOpen: boolean;
  setCaptureOpen: (open: boolean) => void;
}

const InboxContext = createContext<InboxContextValue | null>(null);

const errMessage = (err: unknown): string =>
  err instanceof Error ? err.message : "Something went wrong";

export function InboxProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    listInbox()
      .then(setItems)
      .catch((err) => setError(errMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => reload(), [reload]);

  // Global ⌘N (⌃N) — open quick-capture from anywhere in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setCaptureOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const capture = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text) return null;
    try {
      const item = await captureInbox(text);
      setItems((prev) => [item, ...prev]);
      return item;
    } catch (err) {
      toast.error(`Couldn't capture: ${errMessage(err)}`);
      return null;
    }
  }, []);

  const patch = useCallback(async (item: InboxItem, p: Partial<InboxFrontmatter>) => {
    try {
      const updated = await updateInbox(item, p);
      setItems((prev) => prev.map((i) => (i.path === updated.path ? updated : i)));
    } catch (err) {
      toast.error(`Couldn't save: ${errMessage(err)}`);
    }
  }, []);

  const file = useCallback(async (item: InboxItem, dest: FileDestination) => {
    try {
      await fileInbox(item, dest);
      setItems((prev) => prev.filter((i) => i.path !== item.path));
      toast.success(item.kind === "resource" ? "Filed to Library" : "Filed to Tasks");
    } catch (err) {
      toast.error(`Couldn't file: ${errMessage(err)}`);
    }
  }, []);

  const discard = useCallback(async (item: InboxItem) => {
    try {
      await discardInbox(item);
      setItems((prev) => prev.filter((i) => i.path !== item.path));
      toast.success("Discarded");
    } catch (err) {
      toast.error(`Couldn't discard: ${errMessage(err)}`);
    }
  }, []);

  const openCapture = useCallback(() => setCaptureOpen(true), []);

  const value: InboxContextValue = {
    items,
    loading,
    error,
    count: items.length,
    reload,
    patch,
    file,
    discard,
    capture,
    openCapture,
    captureOpen,
    setCaptureOpen,
  };

  return (
    <InboxContext.Provider value={value}>
      {children}
      <QuickCapture open={captureOpen} onOpenChange={setCaptureOpen} onCapture={capture} />
    </InboxContext.Provider>
  );
}

export function useInbox(): InboxContextValue {
  const ctx = useContext(InboxContext);
  if (!ctx) throw new Error("useInbox must be used within an InboxProvider");
  return ctx;
}
