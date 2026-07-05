/**
 * `rlo logs` (spec §2). Tails <installDir>/logs/service/{web,vault}.log.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { readConfig } from "./config.js";
import type { LogsFlags } from "./cli-args.js";

export function logPathFor(installDir: string, which: "web" | "vault"): string {
  return join(installDir, "logs", "service", `${which}.log`);
}

export function lastLines(filePath: string, n: number): string {
  if (!existsSync(filePath)) return `(no log file at ${filePath})\n`;
  const content = readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  return lines.slice(Math.max(0, lines.length - n - 1)).join("\n");
}

export async function logsCommand(flags: LogsFlags): Promise<number> {
  const config = readConfig();
  if (!config) {
    console.error("No Arel OS install found. Run `npx arelos` to install.");
    return 1;
  }

  const targets: Array<"web" | "vault"> = flags.which === "both" ? ["web", "vault"] : [flags.which];
  const paths = targets.map((t) => logPathFor(config.installDir, t));

  if (flags.follow) {
    const existing = paths.filter((p) => existsSync(p));
    if (existing.length === 0) {
      console.error("No log files found yet.");
      return 1;
    }
    const child = spawn("tail", ["-f", ...existing], { stdio: "inherit" });
    await new Promise((resolve) => child.on("close", resolve));
    return 0;
  }

  for (const [i, target] of targets.entries()) {
    if (targets.length > 1) console.log(`\n==> ${target} <==`);
    console.log(lastLines(paths[i], flags.lines));
  }
  return 0;
}
