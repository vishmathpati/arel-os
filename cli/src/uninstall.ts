/**
 * `rlo uninstall` (spec §2). Vault deletion is gated behind confirm + a
 * literal typed "DELETE" — a single yes can never destroy notes (spec §3.2,
 * acceptance criterion 5). This module separates the pure decision logic
 * (shouldDeleteVault) from the destructive I/O (performUninstall) so the
 * gate can be unit tested without touching a filesystem.
 */
import * as p from "@clack/prompts";
import pc from "picocolors";
import { existsSync, rmSync, unlinkSync } from "node:fs";
import { readConfig } from "./config.js";
import { bootoutService } from "./launchd.js";
import { VAULT_LABEL, WEB_LABEL, plistPath, configPath } from "./paths.js";

/**
 * Pure gate: vault is deleted iff confirmed AND the typed word is exactly
 * "DELETE". Any other input (including case variants, whitespace, empty)
 * preserves the vault. This is the load-bearing safety rule from the spec —
 * kept as an isolated pure function so it's trivially unit-testable.
 */
export function shouldDeleteVault(confirmed: boolean, typedWord: string): boolean {
  return confirmed === true && typedWord === "DELETE";
}

export interface UninstallChoices {
  removeInstallDir: boolean;
  deleteVault: boolean;
  removeConfig: boolean;
}

export async function uninstallCommand(): Promise<number> {
  const config = readConfig();
  if (!config) {
    console.error("No Arel OS install found. Nothing to uninstall.");
    return 1;
  }

  p.intro(pc.bold("Uninstall Arel OS"));

  await bootoutService(WEB_LABEL);
  await bootoutService(VAULT_LABEL);
  for (const label of [WEB_LABEL, VAULT_LABEL] as const) {
    const path = plistPath(label);
    if (existsSync(path)) unlinkSync(path);
  }
  p.log.success("Services stopped and unregistered.");

  const removeInstallDir = await p.confirm({
    message: `Remove the install directory ${config.installDir}?`,
    initialValue: false,
  });
  if (p.isCancel(removeInstallDir)) {
    p.cancel("Uninstall stopped after removing services.");
    return 1;
  }

  let deleteVault = false;
  const vaultConfirm = await p.confirm({
    message: `Also delete your vault at ${config.vaultPath}? This erases all your notes.`,
    initialValue: false,
  });
  if (!p.isCancel(vaultConfirm) && vaultConfirm) {
    const typed = await p.text({
      message: 'Type DELETE (all caps) to confirm permanent vault deletion, or anything else to cancel:',
    });
    const typedWord = p.isCancel(typed) ? "" : String(typed);
    deleteVault = shouldDeleteVault(true, typedWord);
    if (!deleteVault) {
      p.log.message("Vault deletion cancelled — vault preserved.");
    }
  }

  const removeConfig = await p.confirm({
    message: "Remove the saved config (~/.arelos/config.json)? Keeping it lets a reinstall remember your settings.",
    initialValue: false,
  });

  performUninstall(config.installDir, config.vaultPath, {
    removeInstallDir: !p.isCancel(removeInstallDir) && removeInstallDir,
    deleteVault,
    removeConfig: !p.isCancel(removeConfig) && removeConfig,
  });

  p.outro(pc.green("Arel OS uninstalled." + (deleteVault ? "" : " Your vault was preserved.")));
  return 0;
}

/** Destructive I/O, isolated from prompt flow for testability via direct calls with explicit choices. */
export function performUninstall(installDir: string, vaultPath: string, choices: UninstallChoices): void {
  if (choices.deleteVault && existsSync(vaultPath)) {
    rmSync(vaultPath, { recursive: true, force: true });
  }
  if (choices.removeInstallDir && existsSync(installDir)) {
    rmSync(installDir, { recursive: true, force: true });
  }
  if (choices.removeConfig && existsSync(configPath())) {
    unlinkSync(configPath());
  }
}
