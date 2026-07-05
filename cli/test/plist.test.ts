import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { looksLikeValidPlist, renderPlistTemplate } from "../src/plist.js";

// import.meta.dirname is dist-test/test/ once compiled; walk up to the repo root
// (cli/ is one level below the app repo root).
const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");

test("renderPlistTemplate substitutes every {{INSTALL_DIR}} occurrence", () => {
  const template = readFileSync(join(REPO_ROOT, "scripts/service/com.arelos.web.plist.tmpl"), "utf8");
  const rendered = renderPlistTemplate(template, "/tmp/my-install");
  assert.ok(!rendered.includes("{{INSTALL_DIR}}"), "no unsubstituted tokens should remain");
  assert.ok(rendered.includes("/tmp/my-install/scripts/service/run-web.sh"));
  assert.ok(rendered.includes("/tmp/my-install/logs/service/web.log"));
  assert.ok(rendered.includes("<string>com.arelos.web</string>"));
});

test("renderPlistTemplate works for the vault template too", () => {
  const template = readFileSync(join(REPO_ROOT, "scripts/service/com.arelos.vault.plist.tmpl"), "utf8");
  const rendered = renderPlistTemplate(template, "/tmp/my-install");
  assert.ok(rendered.includes("/tmp/my-install/scripts/service/run-vault.sh"));
  assert.ok(rendered.includes("<string>com.arelos.vault</string>"));
});

test("looksLikeValidPlist accepts a fully rendered plist", () => {
  const template = readFileSync(join(REPO_ROOT, "scripts/service/com.arelos.web.plist.tmpl"), "utf8");
  const rendered = renderPlistTemplate(template, "/tmp/x");
  assert.equal(looksLikeValidPlist(rendered), true);
});

test("looksLikeValidPlist rejects a template with unsubstituted tokens", () => {
  const template = readFileSync(join(REPO_ROOT, "scripts/service/com.arelos.web.plist.tmpl"), "utf8");
  assert.equal(looksLikeValidPlist(template), false);
});
