/**
 * `arelos logs`. Tails <root>/logs/service/{web,vault}.log (0.2.0 self-contained
 * layout — logs live at the install root, not inside the app checkout).
 * Legacy (pre-0.2.0) installs have no `root`; their logs live under
 * installDir directly, matching the layout their plists were rendered with.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { resolveInstall } from "./cli-context.js";
import { resolveRoot } from "./config.js";
import type { LogsFlags } from "./cli-args.js";

export function logPathFor(root: string, which: "web" | "vault"): string {
  return join(root, "logs", "service", `${which}.log`);
}

export function lastLines(filePath: string, n: number): string {
  if (!existsSync(filePath)) return `(no log file at ${filePath})\n`;
  const content = readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  return lines.slice(Math.max(0, lines.length - n - 1)).join("\n");
}

export async function logsCommand(flags: LogsFlags, name?: string | null): Promise<number> {
  const result = await resolveInstall({ name, interactive: process.stdout.isTTY === true });
  if (!result.ok) {
    console.error(result.message);
    return 1;
  }
  const config = result.install.config;

  const targets: Array<"web" | "vault"> = flags.which === "both" ? ["web", "vault"] : [flags.which];
  const paths = targets.map((t) => logPathFor(resolveRoot(config), t));

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
