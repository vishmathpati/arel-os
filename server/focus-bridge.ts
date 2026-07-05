/**
 * Arel Focus bridge I/O (Chapter 12). The bridge dir lives OUTSIDE the vault
 * (`~/Library/Application Support/Arel Focus/bridge/`), so it has its own module
 * rather than going through the vault-confined resolver in io.ts.
 *
 * Contract: agents/docs/AREL-FOCUS-BRIDGE-V2.md.
 *
 * Arel OS → Arel Focus: write `commands/{sessionId}.{suffix}.json`.
 * Arel Focus → Arel OS: read `state.json` and `results/{sessionId}.json`.
 *
 * Everything here degrades gracefully when Arel Focus isn't installed: reads
 * return null (standalone mode), writes still succeed (creating the dir) so a
 * later-launched app can pick the command up.
 */

import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/** Bridge root — overridable for tests via AREL_FOCUS_BRIDGE_DIR. */
function bridgeRoot(): string {
  return (
    process.env.AREL_FOCUS_BRIDGE_DIR ??
    join(homedir(), "Library", "Application Support", "Arel Focus", "bridge")
  );
}

/** A command file's sessionId + suffix must be filename-safe. */
const SAFE = /^[A-Za-z0-9._-]+$/;

export class FocusBridgeError extends Error {}

/**
 * Write a command file to `commands/{sessionId}.{suffix}.json`. The body is the
 * full command object the client built (per contract). Creates the dir tree if
 * needed so a not-yet-running Arel Focus can still consume it on launch.
 */
export async function writeFocusCommand(
  sessionId: string,
  suffix: string,
  body: unknown,
): Promise<{ path: string }> {
  if (!SAFE.test(sessionId)) throw new FocusBridgeError("Invalid session id");
  if (!SAFE.test(suffix)) throw new FocusBridgeError("Invalid command suffix");
  const dir = join(bridgeRoot(), "commands");
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${sessionId}.${suffix}.json`);
  await Bun.write(path, JSON.stringify(body, null, 2));
  return { path };
}

/** Read the current Arel Focus state snapshot, or null if absent (standalone). */
export async function readFocusState(): Promise<unknown | null> {
  const file = Bun.file(join(bridgeRoot(), "state.json"));
  if (!(await file.exists())) return null;
  try {
    return await file.json();
  } catch {
    return null;
  }
}

/** Read a session's result file, or null if not written yet. */
export async function readFocusResult(sessionId: string): Promise<unknown | null> {
  if (!SAFE.test(sessionId)) throw new FocusBridgeError("Invalid session id");
  const file = Bun.file(join(bridgeRoot(), "results", `${sessionId}.json`));
  if (!(await file.exists())) return null;
  try {
    return await file.json();
  } catch {
    return null;
  }
}
