import { test } from "node:test";
import assert from "node:assert/strict";
import { formatHealthTimeoutDiagnostics, matchLogSignature } from "../src/health.js";

// --- matchLogSignature -----------------------------------------------------
// Field bug: a health-check timeout just said "check logs", leaving a real
// user stuck on a TCC crash-loop with no idea what was wrong. These tests
// pin the signature matcher that turns a raw log tail into an actionable hint.

test("matchLogSignature recognizes the TCC 'Operation not permitted' signature", () => {
  const hit = matchLogSignature("/bin/bash: /Users/x/Desktop/my-brain/run-web.sh: Operation not permitted");
  assert.ok(hit);
  assert.match(hit!.hint, /Desktop, Documents, Downloads, or iCloud Drive/);
});

test("matchLogSignature is case-insensitive", () => {
  const hit = matchLogSignature("OPERATION NOT PERMITTED");
  assert.ok(hit);
});

test("matchLogSignature recognizes EADDRINUSE as a port conflict", () => {
  const hit = matchLogSignature("Error: listen EADDRINUSE: address already in use :::5274");
  assert.ok(hit);
  assert.match(hit!.hint, /port conflict/);
});

test("matchLogSignature recognizes 'address already in use' phrasing", () => {
  const hit = matchLogSignature("bind: address already in use");
  assert.ok(hit);
  assert.match(hit!.hint, /port conflict/);
});

test("matchLogSignature recognizes a missing-command failure", () => {
  const hit = matchLogSignature("env: bun: command not found");
  assert.ok(hit);
  assert.match(hit!.hint, /missing dependency/);
});

test("matchLogSignature returns null for an unrecognized log tail", () => {
  assert.equal(matchLogSignature("2026-07-05T10:00:00 server listening on :5274"), null);
});

test("matchLogSignature returns null for an empty log tail", () => {
  assert.equal(matchLogSignature(""), null);
});

// --- formatHealthTimeoutDiagnostics ---------------------------------------

test("formatHealthTimeoutDiagnostics includes both log tails and the matched hint", () => {
  const tails: Record<string, string> = {
    "/install/logs/service/web.log": "/bin/bash: /install/run-web.sh: Operation not permitted",
    "/install/logs/service/vault.log": "vault started ok",
  };
  const msg = formatHealthTimeoutDiagnostics(
    "/install",
    (p) => tails[p] ?? "",
    (installDir, which) => `${installDir}/logs/service/${which}.log`,
  );
  assert.match(msg, /Operation not permitted/);
  assert.match(msg, /vault started ok/);
  assert.match(msg, /Desktop, Documents, Downloads, or iCloud Drive/);
  assert.match(msg, /web\.log/);
  assert.match(msg, /vault\.log/);
});

test("formatHealthTimeoutDiagnostics falls back gracefully with no hint when nothing matches", () => {
  const msg = formatHealthTimeoutDiagnostics(
    "/install",
    () => "server booting, please wait",
    (installDir, which) => `${installDir}/logs/service/${which}.log`,
  );
  assert.match(msg, /server booting, please wait/);
  assert.doesNotMatch(msg, /Operation not permitted/);
});

test("formatHealthTimeoutDiagnostics shows (empty) placeholder for an empty log tail", () => {
  const msg = formatHealthTimeoutDiagnostics(
    "/install",
    () => "",
    (installDir, which) => `${installDir}/logs/service/${which}.log`,
  );
  assert.match(msg, /\(empty\)/);
});

test("formatHealthTimeoutDiagnostics prefers the web log's hint when both logs match", () => {
  const msg = formatHealthTimeoutDiagnostics(
    "/install",
    (p) => (p.includes("web") ? "Operation not permitted" : "EADDRINUSE"),
    (installDir, which) => `${installDir}/logs/service/${which}.log`,
  );
  assert.match(msg, /Desktop, Documents, Downloads, or iCloud Drive/);
});
