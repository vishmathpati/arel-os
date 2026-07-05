/**
 * Zero-dependency free-port detection via node:net (spec §1 Step 5).
 *
 * A port must be probed on BOTH loopback families: a server listening only on
 * [::1] (IPv6) leaves 127.0.0.1 bindable, so an IPv4-only probe reports the
 * port "free" while browsers (which resolve localhost to ::1 first) hit the
 * other process. Field-tested: a Node dev server on [::1]:1347 made the
 * installer pre-fill an occupied port. A port counts as free only if every
 * loopback family available on this machine can bind it.
 */
import { createServer } from "node:net";

/** Error codes meaning "this address family isn't available on this machine". */
const FAMILY_UNAVAILABLE = new Set(["EADDRNOTAVAIL", "EAFNOSUPPORT", "EINVAL"]);

type BindResult = "free" | "taken" | "family-unavailable";

/** Try to bind `port` on one loopback host and report what happened. */
function probeBind(port: number, host: string): Promise<BindResult> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", (err: NodeJS.ErrnoException) => {
      server.close();
      if (err.code && FAMILY_UNAVAILABLE.has(err.code)) {
        // No IPv6 (or IPv4) loopback on this machine — nothing to conflict with.
        resolve("family-unavailable");
      } else {
        // EADDRINUSE/EACCES, or anything unexpected — treat conservatively as
        // taken so we never suggest a port we can't actually validate.
        resolve("taken");
      }
    });
    server.once("listening", () => {
      server.close(() => resolve("free"));
    });
    server.listen(port, host);
  });
}

/**
 * Resolve true if `port` is free to bind on ALL applicable loopback families
 * (127.0.0.1 and ::1), false if any listener holds it on either family.
 */
export async function isPortFree(port: number): Promise<boolean> {
  const [v4, v6] = await Promise.all([probeBind(port, "127.0.0.1"), probeBind(port, "::1")]);
  return v4 !== "taken" && v6 !== "taken";
}

/**
 * Find the first free port at or above `start`, scanning upward. Stops at
 * `start + maxScan` to avoid an unbounded loop.
 */
export async function findFreePort(start: number, maxScan = 200): Promise<number> {
  for (let port = start; port < start + maxScan; port++) {
    if (port <= 1023) continue;
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free port found in range ${start}-${start + maxScan}`);
}

export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port > 1023 && port <= 65535;
}
