/**
 * `arelos ports [name]`. Change an existing install's web/vault ports:
 * interactive prompt (default = keep current) or non-interactive
 * `--web-port`/`--vault-port` flags. Registry-aware like status/update/logs
 * (see cli-context.ts resolveInstall).
 *
 * On change: rewrite <root>/config.json atomically, then restart both
 * launchd services (kickstart -k — the web service's run-web.sh rebuilds and
 * re-bakes VITE_VAULT_API from config.json on every start, so a kickstart
 * alone is enough to pick up new ports; see scripts/service/run-web.sh), then
 * health-check both new ports with the existing health/diagnostics machinery.
 *
 * The restart+health-check step is expressed as an injectable "effects"
 * object (RestartEffects) so tests can assert the exact call sequence
 * without ever touching real launchctl or the network.
 */
import * as p from "@clack/prompts";
import pc from "picocolors";
import type { ArelConfig } from "./config.js";
import { resolveRoot, resolveServiceLabels, writeConfig } from "./config.js";
import { resolveInstall } from "./cli-context.js";
import { formatHealthTimeoutDiagnostics, waitForHealthy } from "./health.js";
import { lastLines, logPathFor } from "./logs.js";
import { installConfigPath } from "./paths.js";
import { resolvePort, type PortResolution } from "./install-plan.js";
import { bootstrapAndStart } from "./services.js";

export interface PortsFlags {
  webPort: number | null;
  vaultPort: number | null;
}

/**
 * One resolved port change: `requested` is null when the caller asked to
 * keep the current value (interactive default, or a flag simply omitted).
 */
export interface PortChangeResult {
  field: "webPort" | "vaultPort";
  current: number;
  requested: number | null;
  resolution: PortResolution | null;
  /** True if this field is actually changing (requested differs from current). */
  changed: boolean;
}

export interface PortChangePlan {
  web: PortChangeResult;
  vault: PortChangeResult;
  /** True if either port actually differs from its current value. */
  anyChange: boolean;
}

export type PortChangePlanOutcome =
  | { ok: true; plan: PortChangePlan }
  | { ok: false; message: string };

/**
 * Resolve one requested port against its current value: null (or equal to
 * current) means "keep, no validation needed" — re-validating the port
 * you're already bound to would spuriously fail once services are up and
 * holding it. A genuinely different request must resolve to itself exactly
 * (hard-fail on occupied) — `resolvePortFn` is injected so tests can stub it
 * without touching real sockets, and the real caller passes the hardened
 * `resolvePort` from install-plan.ts.
 */
async function resolveOneField(
  field: "webPort" | "vaultPort",
  current: number,
  requested: number | null,
  resolvePortFn: (port: number) => Promise<PortResolution>,
): Promise<PortChangeResult> {
  if (requested === null || requested === current) {
    return { field, current, requested: null, resolution: null, changed: false };
  }
  const resolution = await resolvePortFn(requested);
  return { field, current, requested, resolution, changed: resolution.resolved === requested };
}

/**
 * Build and validate a port-change plan from the install's current config
 * and the caller's requested new ports (null = keep current). Both fields
 * are validated independently; a requested port that's occupied (and thus
 * would resolve to something other than itself) is a hard failure — ports is
 * a deliberate, exact change, unlike install's "pick something nearby".
 */
export async function buildPortChangePlan(
  current: { webPort: number; vaultPort: number },
  requested: { webPort: number | null; vaultPort: number | null },
  resolvePortFn: (port: number) => Promise<PortResolution> = resolvePort,
): Promise<PortChangePlanOutcome> {
  if (requested.webPort !== null && requested.vaultPort !== null && requested.webPort === requested.vaultPort) {
    return { ok: false, message: `Web port and vault port must differ (both were ${requested.webPort}).` };
  }

  const web = await resolveOneField("webPort", current.webPort, requested.webPort, resolvePortFn);
  if (web.requested !== null && web.resolution && !web.resolution.wasFree) {
    return {
      ok: false,
      message: `Port ${web.requested} is already in use — choose a free port for the web service.`,
    };
  }

  const vault = await resolveOneField("vaultPort", current.vaultPort, requested.vaultPort, resolvePortFn);
  if (vault.requested !== null && vault.resolution && !vault.resolution.wasFree) {
    return {
      ok: false,
      message: `Port ${vault.requested} is already in use — choose a free port for the vault service.`,
    };
  }

  // Cross-field collision: e.g. new web port == current (unchanged) vault port.
  const finalWeb = web.changed ? web.requested! : current.webPort;
  const finalVault = vault.changed ? vault.requested! : current.vaultPort;
  if (finalWeb === finalVault) {
    return { ok: false, message: `Web port and vault port must differ (both would be ${finalWeb}).` };
  }

  return { ok: true, plan: { web, vault, anyChange: web.changed || vault.changed } };
}

/** Apply a resolved plan to a config object, returning the updated config (pure — no I/O). */
export function applyPlanToConfig(config: ArelConfig, plan: PortChangePlan): ArelConfig {
  return {
    ...config,
    webPort: plan.web.changed ? plan.web.requested! : config.webPort,
    vaultPort: plan.vault.changed ? plan.vault.requested! : config.vaultPort,
  };
}

/**
 * The restart + health-check side effects, injected so tests can assert the
 * call sequence without touching launchctl or the network. The real
 * implementation restarts via kickstart -k on both service labels (not a
 * full bootstrap — the services are already registered; ports.ts only
 * changes config, never plist identity) and then re-runs the standard
 * health probe.
 */
export interface RestartEffects {
  restartServices: (labels: { web: string; vault: string }) => Promise<{ errors: string[] }>;
  waitForHealthy: typeof waitForHealthy;
}

export const realRestartEffects: RestartEffects = {
  restartServices: async (labels) => {
    const result = await bootstrapAndStart(labels);
    return { errors: result.errors };
  },
  waitForHealthy,
};

export async function portsCommand(
  flags: PortsFlags,
  name: string | null | undefined,
  effects: RestartEffects = realRestartEffects,
): Promise<number> {
  const result = await resolveInstall({ name, interactive: process.stdout.isTTY === true });
  if (!result.ok) {
    console.error(result.message);
    return 1;
  }
  const { config, root } = result.install;
  const interactive = process.stdout.isTTY === true && flags.webPort === null && flags.vaultPort === null;

  console.log(pc.bold(config.displayName));
  console.log(`  Web port:    ${config.webPort}`);
  console.log(`  Vault port:  ${config.vaultPort}`);
  console.log("");

  let requestedWeb = flags.webPort;
  let requestedVault = flags.vaultPort;

  if (interactive) {
    p.intro(pc.bold("Change ports"));
    const webRaw = await p.text({
      message: "New web port (blank = keep current):",
      placeholder: String(config.webPort),
      defaultValue: String(config.webPort),
    });
    if (p.isCancel(webRaw)) {
      p.cancel("Cancelled.");
      return 1;
    }
    const vaultRaw = await p.text({
      message: "New vault port (blank = keep current):",
      placeholder: String(config.vaultPort),
      defaultValue: String(config.vaultPort),
    });
    if (p.isCancel(vaultRaw)) {
      p.cancel("Cancelled.");
      return 1;
    }
    const webNum = Number(webRaw);
    const vaultNum = Number(vaultRaw);
    requestedWeb = Number.isFinite(webNum) ? webNum : null;
    requestedVault = Number.isFinite(vaultNum) ? vaultNum : null;
  }

  const planOutcome = await buildPortChangePlan(
    { webPort: config.webPort, vaultPort: config.vaultPort },
    { webPort: requestedWeb, vaultPort: requestedVault },
  );
  if (!planOutcome.ok) {
    console.error(pc.red(planOutcome.message));
    return 1;
  }
  const { plan } = planOutcome;

  if (!plan.anyChange) {
    console.log("No change — ports are already what was requested.");
    return 0;
  }

  const updatedConfig = applyPlanToConfig(config, plan);
  const cfgRoot = resolveRoot(config);
  const cfgPath = installConfigPath(cfgRoot);
  writeConfig(updatedConfig, cfgPath);
  console.log(
    pc.green(
      `Config updated: web ${config.webPort} -> ${updatedConfig.webPort}, vault ${config.vaultPort} -> ${updatedConfig.vaultPort}.`,
    ),
  );

  const labels = resolveServiceLabels(updatedConfig);
  console.log("Restarting services…");
  const restart = await effects.restartServices(labels);
  for (const e of restart.errors) console.error(pc.yellow(e));

  console.log("Waiting for the app to come back up…");
  const health = await effects.waitForHealthy(updatedConfig.webPort, updatedConfig.vaultPort);
  if (!health.healthy) {
    console.error(
      pc.red(formatHealthTimeoutDiagnostics(cfgRoot, (path) => lastLines(path, 10), logPathFor)),
    );
    console.error(pc.dim("\nFull logs: arelos logs"));
    return 1;
  }

  console.log(pc.green("Ports changed and Arel OS is healthy again."));
  return 0;
}
