import assert from "node:assert/strict";
import { userInfo } from "node:os";
import { test } from "node:test";
import {
  type BootstrapSequenceEffects,
  POLL_INTERVAL_MS,
  bootstrapServiceSequenced,
  pollUntilGone,
} from "../src/launchd.js";
import { plistPath } from "../src/paths.js";

const uid = userInfo().uid;

test("bootstrapServiceSequenced: happy path runs bootout -> isLoaded -> bootstrap -> isLoaded -> kickstart, in order", async () => {
  const calls: string[] = [];
  // First isLoaded call (the poll) reports gone immediately; second (post-bootstrap verify) reports loaded.
  let isLoadedCallCount = 0;
  const effects: BootstrapSequenceEffects = {
    exec: async (args) => {
      calls.push(`exec:${args.join(" ")}`);
      return { ok: true, stderr: "" };
    },
    isLoaded: async (label) => {
      isLoadedCallCount++;
      calls.push(`isLoaded#${isLoadedCallCount}:${label}`);
      return isLoadedCallCount > 1; // gone on first poll, present on verify
    },
    sleep: async (ms) => {
      calls.push(`sleep:${ms}`);
    },
  };

  const res = await bootstrapServiceSequenced("com.arelos.abc.web", effects);
  assert.equal(res.ok, true);
  assert.deepEqual(calls, [
    `exec:bootout gui/${uid}/com.arelos.abc.web`,
    "isLoaded#1:com.arelos.abc.web",
    `exec:bootstrap gui/${uid} ${plistPath("com.arelos.abc.web")}`,
    "isLoaded#2:com.arelos.abc.web",
    `exec:kickstart -k gui/${uid}/com.arelos.abc.web`,
  ]);
});

test("bootstrapServiceSequenced: polls repeatedly (with sleeps) until the label is confirmed gone before bootstrapping", async () => {
  const calls: string[] = [];
  let isLoadedCallCount = 0;
  const effects: BootstrapSequenceEffects = {
    exec: async (args) => {
      calls.push(`exec:${args[0]}`);
      return { ok: true, stderr: "" };
    },
    isLoaded: async () => {
      isLoadedCallCount++;
      calls.push(`isLoaded#${isLoadedCallCount}`);
      // Still loaded for the first two polls, gone on the third; then loaded again for the post-bootstrap verify.
      if (isLoadedCallCount <= 2) return true;
      if (isLoadedCallCount === 3) return false;
      return true;
    },
    sleep: async (ms) => {
      calls.push(`sleep:${ms}`);
    },
  };

  const res = await bootstrapServiceSequenced("com.arelos.abc.vault", effects);
  assert.equal(res.ok, true);
  assert.deepEqual(calls, [
    "exec:bootout",
    "isLoaded#1",
    "sleep:500",
    "isLoaded#2",
    "sleep:500",
    "isLoaded#3", // gone -> stop polling
    "exec:bootstrap",
    "isLoaded#4", // post-bootstrap verify
    "exec:kickstart",
  ]);
});

test("pollUntilGone: returns true as soon as isLoaded reports false, without waiting out the full timeout", async () => {
  const sleeps: number[] = [];
  let calls = 0;
  const effects: BootstrapSequenceEffects = {
    exec: async () => ({ ok: true, stderr: "" }),
    isLoaded: async () => {
      calls++;
      return calls < 3; // gone on the 3rd check
    },
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  };
  const gone = await pollUntilGone("com.arelos.abc.web", effects);
  assert.equal(gone, true);
  assert.equal(calls, 3);
  assert.deepEqual(sleeps, [POLL_INTERVAL_MS, POLL_INTERVAL_MS]);
});

test("pollUntilGone: gives up and returns false once the timeout budget is exhausted", async () => {
  let elapsed = 0;
  const effects: BootstrapSequenceEffects = {
    exec: async () => ({ ok: true, stderr: "" }),
    isLoaded: async () => true, // never goes away
    sleep: async (ms) => {
      elapsed += ms;
    },
  };
  // A short real timeout budget (the poll loop checks real elapsed time between injected-sleep
  // calls, so this genuinely takes ~120ms of wall clock — kept small to keep the suite fast).
  const gone = await pollUntilGone("com.arelos.abc.web", effects, 120, 40);
  assert.equal(gone, false);
  assert.ok(elapsed >= 120, `expected at least 120ms of simulated sleep, got ${elapsed}`);
});

test("bootstrapServiceSequenced: retries bootstrap once after a 2s backoff when it fails with an EIO signature", async () => {
  const calls: string[] = [];
  let bootstrapAttempts = 0;
  let isLoadedCallCount = 0;
  const effects: BootstrapSequenceEffects = {
    exec: async (args) => {
      calls.push(`exec:${args[0]}`);
      if (args[0] === "bootstrap") {
        bootstrapAttempts++;
        if (bootstrapAttempts === 1) {
          return { ok: false, stderr: "Bootstrap failed: 5: Input/output error" };
        }
        return { ok: true, stderr: "" };
      }
      return { ok: true, stderr: "" };
    },
    // First call is the post-bootout poll (report gone immediately, no busy-wait);
    // second call is the post-bootstrap verify (report loaded).
    isLoaded: async () => {
      isLoadedCallCount++;
      const loaded = isLoadedCallCount > 1;
      calls.push(`isLoaded:${loaded}`);
      return loaded;
    },
    sleep: async (ms) => {
      calls.push(`sleep:${ms}`);
    },
  };

  const res = await bootstrapServiceSequenced("com.arelos.abc.web", effects);
  assert.equal(res.ok, true);
  assert.equal(bootstrapAttempts, 2);
  // bootout -> isLoaded(gone, no extra sleep since first check is gone) -> bootstrap(fail, EIO) -> sleep 2000 -> bootstrap(ok) -> isLoaded(verify) -> kickstart
  assert.deepEqual(calls, [
    "exec:bootout",
    "isLoaded:false",
    "exec:bootstrap",
    "sleep:2000",
    "exec:bootstrap",
    "isLoaded:true",
    "exec:kickstart",
  ]);
});

test("bootstrapServiceSequenced: does not retry when bootstrap fails with a non-EIO error", async () => {
  const calls: string[] = [];
  const effects: BootstrapSequenceEffects = {
    exec: async (args) => {
      calls.push(`exec:${args[0]}`);
      if (args[0] === "bootstrap")
        return { ok: false, stderr: "Load failed: 13: Permission denied" };
      return { ok: true, stderr: "" };
    },
    isLoaded: async () => {
      calls.push("isLoaded");
      return false; // gone immediately, no busy-wait
    },
    sleep: async (ms) => {
      calls.push(`sleep:${ms}`);
    },
  };

  const res = await bootstrapServiceSequenced("com.arelos.abc.web", effects);
  assert.equal(res.ok, false);
  assert.match(res.stderr, /Permission denied/);
  assert.deepEqual(calls, ["exec:bootout", "isLoaded", "exec:bootstrap"]);
});

test("bootstrapServiceSequenced: fails if bootstrap reports success but the label never shows up as loaded", async () => {
  const effects: BootstrapSequenceEffects = {
    exec: async () => ({ ok: true, stderr: "" }),
    isLoaded: async () => false, // never loaded, even after "successful" bootstrap
    sleep: async () => {},
  };
  const res = await bootstrapServiceSequenced("com.arelos.abc.web", effects);
  assert.equal(res.ok, false);
  assert.match(res.stderr, /not loaded/);
});

test("bootstrapServiceSequenced: kickstart failure is surfaced as the overall failure", async () => {
  let isLoadedCallCount = 0;
  const effects: BootstrapSequenceEffects = {
    exec: async (args) => {
      if (args[0] === "kickstart") return { ok: false, stderr: "kickstart: no such process" };
      return { ok: true, stderr: "" };
    },
    // First call (post-bootout poll) reports gone; second (post-bootstrap verify) reports loaded.
    isLoaded: async () => {
      isLoadedCallCount++;
      return isLoadedCallCount > 1;
    },
    sleep: async () => {},
  };
  const res = await bootstrapServiceSequenced("com.arelos.abc.web", effects);
  assert.equal(res.ok, false);
  assert.match(res.stderr, /no such process/);
});
