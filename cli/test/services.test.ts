import assert from "node:assert/strict";
import { userInfo } from "node:os";
import { test } from "node:test";
import type { BootstrapSequenceEffects } from "../src/launchd.js";
import { bootstrapAndStart } from "../src/services.js";

const uid = userInfo().uid;

/** Effects where every exec call succeeds and each label reports gone-then-loaded (poll, then verify). */
function passingEffects(calls: string[]): BootstrapSequenceEffects {
  const isLoadedCounts = new Map<string, number>();
  return {
    exec: async (args) => {
      calls.push(`exec:${args.join(" ")}`);
      return { ok: true, stderr: "" };
    },
    isLoaded: async (label) => {
      const count = (isLoadedCounts.get(label) ?? 0) + 1;
      isLoadedCounts.set(label, count);
      calls.push(`isLoaded:${label}:${count}`);
      return count > 1; // gone on the first (poll) check, loaded on the second (verify) check
    },
    sleep: async () => {},
  };
}

test("bootstrapAndStart: runs the full sequenced bootstrap for both web and vault labels", async () => {
  const calls: string[] = [];
  const labels = { web: "com.arelos.abc.web", vault: "com.arelos.abc.vault" };
  const result = await bootstrapAndStart(labels, passingEffects(calls));

  assert.equal(result.web, true);
  assert.equal(result.vault, true);
  assert.deepEqual(result.errors, []);

  for (const label of [labels.web, labels.vault]) {
    assert.ok(calls.includes(`exec:bootout gui/${uid}/${label}`), `expected bootout for ${label}`);
    assert.ok(
      calls.includes(`exec:kickstart -k gui/${uid}/${label}`),
      `expected kickstart for ${label}`,
    );
  }
  assert.equal(calls.filter((c) => c.startsWith("exec:bootstrap")).length, 2);
});

test("bootstrapAndStart: a kickstart failure on one label surfaces as a labeled error, the other label still succeeds", async () => {
  const labels = { web: "com.arelos.abc.web", vault: "com.arelos.abc.vault" };
  const isLoadedCounts = new Map<string, number>();
  const effects: BootstrapSequenceEffects = {
    exec: async (args) => {
      if (args[0] === "kickstart" && args[2]?.endsWith(labels.web)) {
        return { ok: false, stderr: "kickstart failed for web" };
      }
      return { ok: true, stderr: "" };
    },
    isLoaded: async (label) => {
      const count = (isLoadedCounts.get(label) ?? 0) + 1;
      isLoadedCounts.set(label, count);
      return count > 1;
    },
    sleep: async () => {},
  };

  const result = await bootstrapAndStart(labels, effects);
  assert.equal(result.web, false);
  assert.equal(result.vault, true);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /web bootstrap:.*kickstart failed for web/);
});
