/**
 * Plist template rendering. Templates ship at
 * `scripts/service/{web,vault}.plist.tmpl` in the app repo and take three
 * tokens:
 *   - {{INSTALL_DIR}} — the app checkout (root/app): where run-*.sh lives and
 *     the job's WorkingDirectory.
 *   - {{ROOT_DIR}} — the self-contained install root: where logs/service/
 *     lives (0.2.0 self-contained layout — logs are a root-level concern, not
 *     nested inside the app checkout).
 *   - {{LABEL}} — the per-install launchd label from paths.ts deriveServiceLabels.
 * Ports/vaultPath are read from config at process start by the run-*.sh
 * scripts / server, never baked into the plist.
 */
export function renderPlistTemplate(template: string, installDir: string, rootDir: string, label: string): string {
  return template
    .split("{{INSTALL_DIR}}")
    .join(installDir)
    .split("{{ROOT_DIR}}")
    .join(rootDir)
    .split("{{LABEL}}")
    .join(label);
}

/** Basic structural sanity check without shelling out to `plutil` (used in unit tests; `plutil -lint` is used in the dry-run for the real macOS check). */
export function looksLikeValidPlist(xml: string): boolean {
  return (
    xml.includes("<?xml") &&
    xml.includes("<!DOCTYPE plist") &&
    xml.includes("<plist") &&
    xml.includes("</plist>") &&
    !xml.includes("{{")
  );
}
