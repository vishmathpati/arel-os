import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveServiceLabels, installSlug } from "../src/paths.js";

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
