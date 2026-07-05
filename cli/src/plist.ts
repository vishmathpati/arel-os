/**
 * Plist template rendering (portability-contract.md §3.1). Templates ship at
 * `scripts/service/{web,vault}.plist.tmpl` in the app repo and take two
 * tokens — {{INSTALL_DIR}} and {{LABEL}} (the per-install launchd label from
 * paths.ts deriveServiceLabels). Ports/vaultPath are read from config at
 * process start by the run-*.sh scripts / server, never baked into the plist.
 */
export function renderPlistTemplate(template: string, installDir: string, label: string): string {
  return template.split("{{INSTALL_DIR}}").join(installDir).split("{{LABEL}}").join(label);
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
