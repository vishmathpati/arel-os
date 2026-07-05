/**
 * launchctl wrapper (modern per-GUI-domain bootstrap/bootout/kickstart API).
 * Every op is idempotent per spec §3.2: bootout-then-bootstrap never errors
 * on "already loaded"; a --no-service dry run skips all of this.
 */
import { userInfo } from "node:os";
import { runCapture } from "./exec.js";
import { VAULT_LABEL, WEB_LABEL, plistPath } from "./paths.js";

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

export async function bootstrapService(label: typeof WEB_LABEL | typeof VAULT_LABEL): Promise<RunOutcome> {
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
