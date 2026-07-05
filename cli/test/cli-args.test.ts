import { test } from "node:test";
import assert from "node:assert/strict";
import { parseInstallFlags, parseLogsFlags } from "../src/cli-args.js";

test("parseInstallFlags reads --yes/--defaults, --no-service, and --local-repo", () => {
  const flags = parseInstallFlags(["--yes", "--no-service", "--local-repo", "/x/y"]);
  assert.equal(flags.yes, true);
  assert.equal(flags.noService, true);
  assert.equal(flags.localRepo, "/x/y");
});

test("parseInstallFlags reads all install-answer overrides", () => {
  const flags = parseInstallFlags([
    "--display-name",
    "Test Brain",
    "--root",
    "/tmp/test-brain-root",
    "--parent-dir",
    "/tmp",
    "--web-port",
    "5291",
    "--vault-port",
    "5292",
  ]);
  assert.equal(flags.displayName, "Test Brain");
  assert.equal(flags.root, "/tmp/test-brain-root");
  assert.equal(flags.parentDir, "/tmp");
  assert.equal(flags.webPort, 5291);
  assert.equal(flags.vaultPort, 5292);
});

test("parseInstallFlags defaults unset flags to null/false", () => {
  const flags = parseInstallFlags([]);
  assert.equal(flags.yes, false);
  assert.equal(flags.noService, false);
  assert.equal(flags.localRepo, null);
  assert.equal(flags.displayName, null);
});

test("parseLogsFlags defaults to both streams, no follow, 100 lines", () => {
  const flags = parseLogsFlags([]);
  assert.deepEqual(flags, { which: "both", follow: false, lines: 100 });
});

test("parseLogsFlags reads a target stream, -f, and -n", () => {
  assert.deepEqual(parseLogsFlags(["web"]), { which: "web", follow: false, lines: 100 });
  assert.deepEqual(parseLogsFlags(["vault", "-f"]), { which: "vault", follow: true, lines: 100 });
  assert.deepEqual(parseLogsFlags(["-n", "20"]), { which: "both", follow: false, lines: 20 });
});
