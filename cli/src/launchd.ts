/**
 * launchctl wrapper (modern per-GUI-domain bootstrap/bootout/kickstart API).
 * Every op is idempotent per spec §3.2: bootout-then-bootstrap never errors
 * on "already loaded"; a --no-service dry run skips all of this.
 *
 * Field report conclusion — "Bootstrap failed: 5: Input/output error":
 * launchd's errno 5 (EIO) here is a catch-all it surfaces for several distinct
 * setup failures, not just "job already loaded". Two concrete causes were
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

export async function bootoutService(label: string): Promise<void> {
  // Ignore errors — idempotent "unload if loaded".
  await runCapture("launchctl", ["bootout", `${guiDomain()}/${label}`]);
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
