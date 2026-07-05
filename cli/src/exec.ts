/**
 * Thin wrappers over node:child_process so the rest of the CLI never calls
 * execFileSync/spawn directly — keeps side effects easy to find and stub.
 */
import { execFileSync, spawn, type SpawnOptions } from "node:child_process";

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Run a command to completion, streaming its stdout/stderr to ours. */
export function runStreaming(cmd: string, args: string[], opts: SpawnOptions = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], ...opts });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => {
      stdout += d.toString();
      process.stdout.write(d);
    });
    child.stderr?.on("data", (d) => {
      stderr += d.toString();
      process.stderr.write(d);
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

/** Run a command silently, capturing output, never throwing on nonzero exit. */
export function runCapture(cmd: string, args: string[], opts: SpawnOptions = {}): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], ...opts });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => (stdout += d.toString()));
    child.stderr?.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => resolve({ code: 1, stdout, stderr: String(err) }));
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

/** True if `cmd` exists on PATH and runs without error (e.g. `git --version`). */
export function commandExists(cmd: string, versionArgs: string[] = ["--version"]): boolean {
  try {
    execFileSync(cmd, versionArgs, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
