/**
 * Focus bridge client (Ch12) — typed wrappers over the Bun server's /focus/*
 * endpoints. Browser-only (fetch). These talk to Arel Focus indirectly; every
 * call degrades to a no-op/null when Arel Focus isn't running (standalone mode).
 */

import type {
  FocusCommand,
  FocusSessionResult,
  FocusStateSnapshot,
} from "@/shared/lib/focus/contract";

const BASE_URL = import.meta.env.VITE_VAULT_API ?? "http://localhost:5274";

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // keep status line
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

/**
 * Send a command to Arel Focus (writes a command file). Best-effort: a failure
 * (server down, no Arel Focus) is swallowed so it never blocks the local timer —
 * the session is the source of truth, blocking is a bonus. Returns true on write.
 */
export async function sendCommand(command: FocusCommand): Promise<boolean> {
  try {
    await unwrap(
      await fetch(`${BASE_URL}/focus/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      }),
    );
    return true;
  } catch {
    return false;
  }
}

/** Read Arel Focus's current state, or null when it isn't running (standalone). */
export async function fetchState(): Promise<FocusStateSnapshot | null> {
  try {
    const { state } = await unwrap<{ state: FocusStateSnapshot | null }>(
      await fetch(`${BASE_URL}/focus/state`),
    );
    return state;
  } catch {
    return null;
  }
}

/** Read a finished session's result file, or null until Arel Focus writes it. */
export async function fetchResult(sessionId: string): Promise<FocusSessionResult | null> {
  try {
    const { result } = await unwrap<{ result: FocusSessionResult | null }>(
      await fetch(`${BASE_URL}/focus/result?session=${encodeURIComponent(sessionId)}`),
    );
    return result;
  } catch {
    return null;
  }
}
