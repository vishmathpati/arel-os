import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveServiceLabels, installSlug, isTccProtectedPath } from "../src/paths.js";

test("installSlug is stable across repeated calls for the same installDir", () => {
  const a = installSlug("/Users/vish/ArelOS");
  const b = installSlug("/Users/vish/ArelOS");
  assert.equal(a, b);
});

test("installSlug is a 6-8 char lowercase hex string", () => {
  const slug = installSlug("/Users/vish/ArelOS");
  assert.match(slug, /^[0-9a-f]{6,8}$/);
});

test("installSlug differs across different installDirs", () => {
  const a = installSlug("/Users/vish/ArelOS");
  const b = installSlug("/Users/vish/ArelOS-second");
  assert.notEqual(a, b);
});

test("deriveServiceLabels is stable across repeated calls for the same installDir", () => {
  const a = deriveServiceLabels("/Users/vish/ArelOS");
  const b = deriveServiceLabels("/Users/vish/ArelOS");
  assert.deepEqual(a, b);
});

test("deriveServiceLabels produces distinct labels for distinct installDirs", () => {
  const a = deriveServiceLabels("/Users/vish/ArelOS");
  const b = deriveServiceLabels("/Users/vish/ArelOS-second");
  assert.notEqual(a.web, b.web);
  assert.notEqual(a.vault, b.vault);
});

test("deriveServiceLabels produces the expected com.arelos.<slug>.{web,vault} shape", () => {
  const labels = deriveServiceLabels("/Users/vish/ArelOS");
  const slug = installSlug("/Users/vish/ArelOS");
  assert.equal(labels.web, `com.arelos.${slug}.web`);
  assert.equal(labels.vault, `com.arelos.${slug}.vault`);
});

// --- isTccProtectedPath ---------------------------------------------------
// Field bug: launchd-spawned services get `Operation not permitted` (exit
// 126) and crash-loop forever when installed inside Desktop/Documents/
// Downloads/iCloud Drive, because macOS TCC never grants background
// processes access to those folders. This guard must catch every path shape
// that resolves into one of them.

const HOME = "/Users/vish";

test("isTccProtectedPath flags a path directly inside Desktop", () => {
  assert.equal(isTccProtectedPath(`${HOME}/Desktop/my-brain`, HOME), true);
});

test("isTccProtectedPath flags a path nested arbitrarily deep inside Documents", () => {
  assert.equal(isTccProtectedPath(`${HOME}/Documents/a/b/c/my-brain`, HOME), true);
});

test("isTccProtectedPath flags a path inside Downloads", () => {
  assert.equal(isTccProtectedPath(`${HOME}/Downloads/my-brain`, HOME), true);
});

test("isTccProtectedPath flags a path inside iCloud Drive (Library/Mobile Documents)", () => {
  assert.equal(isTccProtectedPath(`${HOME}/Library/Mobile Documents/com~apple~CloudDocs/my-brain`, HOME), true);
});

test("isTccProtectedPath flags the exact protected dir itself, with no subfolder", () => {
  assert.equal(isTccProtectedPath(`${HOME}/Desktop`, HOME), true);
  assert.equal(isTccProtectedPath(`${HOME}/Documents`, HOME), true);
  assert.equal(isTccProtectedPath(`${HOME}/Downloads`, HOME), true);
});

test("isTccProtectedPath allows the exact home root", () => {
  assert.equal(isTccProtectedPath(HOME, HOME), false);
  assert.equal(isTccProtectedPath("~", HOME), false);
});

test("isTccProtectedPath allows a sibling name that merely starts with the same string (~/Desktopx)", () => {
  assert.equal(isTccProtectedPath(`${HOME}/Desktopx`, HOME), false);
  assert.equal(isTccProtectedPath(`${HOME}/Desktopx/my-brain`, HOME), false);
  assert.equal(isTccProtectedPath(`${HOME}/Documents2`, HOME), false);
});

test("isTccProtectedPath allows unrelated home-relative paths", () => {
  assert.equal(isTccProtectedPath(`${HOME}/my-brain`, HOME), false);
  assert.equal(isTccProtectedPath(`${HOME}/arelos`, HOME), false);
  assert.equal(isTccProtectedPath("~/my-brain", HOME), false);
});

test("isTccProtectedPath allows paths entirely outside home (e.g. /private/tmp)", () => {
  assert.equal(isTccProtectedPath("/private/tmp/my-brain", HOME), false);
});

test("isTccProtectedPath handles case-insensitivity like macOS's default filesystem", () => {
  assert.equal(isTccProtectedPath(`${HOME}/DESKTOP/my-brain`, HOME), true);
  assert.equal(isTccProtectedPath(`${HOME}/desktop/My-Brain`, HOME), true);
});

test("isTccProtectedPath handles a trailing slash on the protected dir", () => {
  assert.equal(isTccProtectedPath(`${HOME}/Desktop/`, HOME), true);
});

test("isTccProtectedPath expands ~ before checking", () => {
  assert.equal(isTccProtectedPath("~/Desktop/my-brain", HOME), true);
  assert.equal(isTccProtectedPath("~/Downloads", HOME), true);
});
