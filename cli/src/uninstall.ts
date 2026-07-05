/**
 * `arelos uninstall`. Vault deletion is gated behind confirm + a literal typed
 * "DELETE" — a single yes can never destroy notes. This module separates the
 * pure decision logic (shouldDeleteVault) from the destructive I/O
 * (performUninstall) so the gate can be unit tested without touching a
 * filesystem.
 *
 * 0.2.0 self-contained layout: installDir (root/app) and vaultPath (root/vault)
 * are siblings under root, so removing installDir never touches the vault —
 * the pre-0.2.0 "install dir vs vault" gate semantics carry over unchanged.
 * Removing the registry entry is separate from folder/vault deletion (always
 * done, since a stale registry entry pointing at a gone or kept-around
 * install is never useful).
 */
import * as p from "@clack/prompts";
import pc from "picocolors";
import { existsSync, rmSync, unlinkSync } from "node:fs";
import { resolveRoot, resolveServiceLabels } from "./config.js";
import { resolveInstall } from "./cli-context.js";
import { bootoutService } from "./launchd.js";
import { plistPath, installConfigPath, legacyConfigPath } from "./paths.js";
import { removeRegistryEntry } from "./registry.js";

/**
 * Pure gate: vault is deleted iff confirmed AND the typed word is exactly
 * "DELETE". Any other input (including case variants, whitespace, empty)
 * preserves the vault. This is the load-bearing safety rule — kept as an
 * isolated pure function so it's trivially unit-testable.
 */
export function shouldDeleteVault(confirmed: boolean, typedWord: string): boolean {
  return confirmed === true && typedWord === "DELETE";
}

export interface UninstallChoices {
  removeInstallDir: boolean;
  deleteVault: boolean;
  removeConfig: boolean;
}

export async function uninstallCommand(name?: string | null): Promise<number> {
  const result = await resolveInstall({ name, interactive: process.stdout.isTTY === true });
  if (!result.ok) {
    console.error(result.message);
    return 1;
  }
  const { config, root } = result.install;

  p.intro(pc.bold("Uninstall Arel OS"));

  const labels = resolveServiceLabels(config);
  await bootoutService(labels.web);
  await bootoutService(labels.vault);
  for (const label of [labels.web, labels.vault]) {
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
    message: "Remove the saved config? Keeping it lets a reinstall remember your settings.",
    initialValue: false,
  });

  performUninstall(config.installDir, config.vaultPath, resolveRoot(config), {
    removeInstallDir: !p.isCancel(removeInstallDir) && removeInstallDir,
    deleteVault,
    removeConfig: !p.isCancel(removeConfig) && removeConfig,
  });

  if (root) removeRegistryEntry(root);

  p.outro(pc.green("Arel OS uninstalled." + (deleteVault ? "" : " Your vault was preserved.")));
  return 0;
}

/**
 * Destructive I/O, isolated from prompt flow for testability via direct
 * calls with explicit choices. `root` is passed separately from `installDir`
 * so config.json (which lives at root, a parent of installDir) is removed
 * correctly rather than assumed to live inside installDir.
 */
export function performUninstall(
  installDir: string,
  vaultPath: string,
  root: string,
  choices: UninstallChoices,
): void {
  if (choices.deleteVault && existsSync(vaultPath)) {
    rmSync(vaultPath, { recursive: true, force: true });
  }
  if (choices.removeInstallDir && existsSync(installDir)) {
    rmSync(installDir, { recursive: true, force: true });
  }
  if (choices.removeConfig) {
    const cfgPath = installConfigPath(root);
    if (existsSync(cfgPath)) unlinkSync(cfgPath);
    if (existsSync(legacyConfigPath())) unlinkSync(legacyConfigPath());
  }
}
