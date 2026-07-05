/**
 * launchctl wrapper (modern per-GUI-domain bootstrap/bootout/kickstart API).
 * Every op is idempotent per spec §3.2: bootout-then-bootstrap never errors
 * on "already loaded"; a --no-service dry run skips all of this.
 *
 * Field report conclusion — "Bootstrap failed: 5: Input/output error":
 * launchd's errno 5 (EIO) here is a catch-all it surfaces for several distinct
 * setup failures, not just "job already loaded". Three concrete causes were
 * found and fixed in this codebase:
 *   1. Label collision (the actual reported bug) — a second install on the
 *      same Mac reused the fixed labels com.arelos.web/.vault. Bootstrapping
 *      a plist under a label already claimed by a *different* plist path
 *      (the first install's) is exactly the kind of state launchd reports as
 *      an I/O error rather than a clean "already exists". Fixed by deriving a
 *      per-installDir label (paths.ts deriveServiceLabels) so two installs
 *      never share a label.
 *   2. Missing log directory — the plists' StandardOutPath/StandardErrorPath
 *      point at <installDir>/logs/service/*.log. If that directory doesn't
 *      exist yet, launchd can fail to set up the job's stdio redirection at
 *      bootstrap/first-spawn time. install.ts already called ensureLogsDir
 *      before registering services, but repair.ts/update.ts funneled straight
 *      into installServiceFiles without it — a real gap for any repair/update
 *      run where logs/service/ had been deleted or never existed. Fixed by
 *      making installServiceFiles itself create the directory unconditionally
 *      (see services.ts), so all three callers get it for free.
 *   3. Bootstrap race (field-verified) — bootout is asynchronous: launchd
 *      accepts the bootout request and begins tearing the job down, but the
 *      job's label can still be registered for a short window afterward.
 *      Immediately bootstrapping a plist under that same label while the old
 *      instance is still terminating fails with the same "Bootstrap failed:
 *      5: Input/output error". Fixed by polling `launchctl list` after
 *      bootout until the label is confirmed gone (or a timeout elapses)
 *      before bootstrapping — see bootstrapServiceSequenced below. This was
 *      manually reproduced and the fix manually verified against a real
 *      install before being encoded here as injectable, testable logic.
 * The domain string ("gui/<uid>") and the bootout-before-bootstrap idempotency
 * pattern were checked and are correct as written — not a contributor here.
 */
import { userInfo } from "node:os";
import { runCapture } from "./exec.js";
import { plistPath } from "./paths.js";

function uid(): number {
  return userInfo().uid;
}

function guiDomain(): string {
  return `gui/${uid()}`;
}

/**
 * Injectable side effects for the bootstrap sequence, so tests can assert
 * the exact call order (bootout -> poll -> bootstrap -> verify -> kickstart,
 * incl. the retry-on-EIO branch) without ever shelling out to real
 * launchctl or sleeping in real wall-clock time.
 */
export interface BootstrapSequenceEffects {
  /** Runs `launchctl <args>`, capturing output — same contract as runCapture. */
  exec: (args: string[]) => Promise<RunOutcome>;
  /** True if `label` currently appears in `launchctl list`. */
  isLoaded: (label: string) => Promise<boolean>;
  sleep: (ms: number) => Promise<void>;
}

const realEffects: BootstrapSequenceEffects = {
  exec: async (args) => {
    const res = await runCapture("launchctl", args);
    return { ok: res.code === 0, stderr: res.stderr };
  },
  isLoaded: async (label) => {
    const res = await runCapture("launchctl", ["list"]);
    return res.stdout.split("\n").some((l) => l.trim().endsWith(label));
  },
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/** How long (and how often) to poll for the old instance's label to disappear after bootout. */
export const POLL_TIMEOUT_MS = 15_000;
export const POLL_INTERVAL_MS = 500;

function isEioStderr(stderr: string): boolean {
  return /input\/output error/i.test(stderr) || /:\s*5:/.test(stderr);
}

export async function bootoutService(
  label: string,
  effects: BootstrapSequenceEffects = realEffects,
): Promise<void> {
  // Ignore errors — idempotent "unload if loaded".
  await effects.exec(["bootout", `${guiDomain()}/${label}`]);
}

/**
 * Poll `launchctl list` until `label` is gone or `timeoutMs` elapses.
 * Returns true once confirmed gone, false on timeout (the caller proceeds to
 * bootstrap anyway — a timeout here just means "give up waiting", not "abort
 * the whole sequence", since the label may simply never have been loaded).
 */
export async function pollUntilGone(
  label: string,
  effects: BootstrapSequenceEffects = realEffects,
  timeoutMs = POLL_TIMEOUT_MS,
  intervalMs = POLL_INTERVAL_MS,
): Promise<boolean> {
  const start = Date.now();
  for (;;) {
    const loaded = await effects.isLoaded(label);
    if (!loaded) return true;
    if (Date.now() - start >= timeoutMs) return false;
    await effects.sleep(intervalMs);
  }
}

/**
 * Field-verified fix sequence for the bootstrap race (see module docstring
 * cause #3): bootout (ignore failure) -> poll until the label is confirmed
 * gone -> bootstrap -> verify the label is now present -> kickstart. If
 * bootstrap still comes back with the same EIO signature (a genuinely
 * transient launchd hiccup, distinct from the race this already guards
 * against), retry it once after a 2s backoff before giving up.
 */
export async function bootstrapServiceSequenced(
  label: string,
  effects: BootstrapSequenceEffects = realEffects,
): Promise<RunOutcome> {
  await bootoutService(label, effects);
  await pollUntilGone(label, effects);

  let res = await effects.exec(["bootstrap", guiDomain(), plistPath(label)]);
  if (!res.ok && isEioStderr(res.stderr)) {
    await effects.sleep(2000);
    res = await effects.exec(["bootstrap", guiDomain(), plistPath(label)]);
  }
  if (!res.ok) return { ok: false, stderr: res.stderr };

  const nowLoaded = await effects.isLoaded(label);
  if (!nowLoaded) {
    return {
      ok: false,
      stderr: res.stderr || `bootstrap reported success but ${label} is not loaded`,
    };
  }

  const kick = await effects.exec(["kickstart", "-k", `${guiDomain()}/${label}`]);
  return { ok: kick.ok, stderr: kick.stderr };
}

export async function bootstrapService(label: string): Promise<RunOutcome> {
  await bootoutService(label);
  const res = await runCapture("launchctl", ["bootstrap", guiDomain(), plistPath(label)]);
  return { ok: res.code === 0, stderr: res.stderr };
}

export async function kickstartService(label: string): Promise<RunOutcome> {
  const res = await runCapture("launchctl", ["kickstart", "-k", `${guiDomain()}/${label}`]);
  return { ok: res.code === 0, stderr: res.stderr };
}

export interface RunOutcome {
  ok: boolean;
  stderr: string;
}

export interface ServiceStatus {
  label: string;
  loaded: boolean;
  pid: number | null;
  lastExitCode: number | null;
}

/** Best-effort parse of `launchctl list | grep com.arelos`. */
export async function getServiceStatus(label: string): Promise<ServiceStatus> {
  const res = await runCapture("launchctl", ["list"]);
  const line = res.stdout.split("\n").find((l) => l.trim().endsWith(label));
  if (!line) return { label, loaded: false, pid: null, lastExitCode: null };
  const parts = line.trim().split(/\s+/);
  const pidRaw = parts[0];
  const exitRaw = parts[1];
  return {
    label,
    loaded: true,
    pid: pidRaw === "-" ? null : Number(pidRaw),
    lastExitCode: exitRaw === "-" ? null : Number(exitRaw),
  };
}

export function guiDomainForTest(): string {
  return guiDomain();
}

/**
 * All currently-loaded launchd labels starting with "com.arelos." — used by
 * install preflight to detect a same-slug reinstall vs. an unrelated,
 * still-running Arel OS install that grabbed different labels first.
 */
export async function listLoadedArelosLabels(): Promise<string[]> {
  const res = await runCapture("launchctl", ["list"]);
  return res.stdout
    .split("\n")
    .map((l) => l.trim().split(/\s+/).pop())
    .filter((label): label is string => !!label && label.startsWith("com.arelos."));
}
