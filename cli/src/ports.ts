/**
 * Zero-dependency free-port detection via node:net (spec §1 Step 5).
 *
 * A port must be probed on every listener shape a process can occupy it
 * with, not just the specific loopback addresses:
 *
 * - A server listening only on [::1] (IPv6) leaves 127.0.0.1 bindable, so an
 *   IPv4-only probe reports the port "free" while browsers (which resolve
 *   localhost to ::1 first) hit the other process. Field-tested: a Node dev
 *   server on [::1]:1347 made the installer pre-fill an occupied port.
 * - A server listening on the WILDCARD address (e.g. `Bun.serve()` with no
 *   `hostname`, or `net.createServer().listen(port)` with no host) binds
 *   every local address in that family, including both loopback addresses,
 *   yet a bind-probe of 127.0.0.1/::1 alone can still report "free" on
 *   macOS: binding a specific address with SO_REUSEADDR (Node's default) can
 *   succeed even though a wildcard listener already holds the port. Real
 *   incident: `isPortFree(5274)` reported free while a Bun server held
 *   `*:5274`, and the installer wrote that occupied port into config.
 *
 * The fix probes both shapes with two independent techniques:
 *   1. Bind-probes on the specific loopback addresses AND the wildcard
 *      addresses for each family. A wildcard bind-probe fails with
 *      EADDRINUSE whenever *any* listener (wildcard or specific) holds the
 *      port in that family — it is the strongest bind test available.
 *   2. A short-timeout TCP connect-probe to 127.0.0.1 and ::1. A successful
 *      connection proves the port is occupied even in edge cases the bind
 *      probes can't reach; ECONNREFUSED proves free for that family; a
 *      timeout or other inconclusive result is never treated as occupied on
 *      its own.
 *
 * A port counts as free only if every applicable bind probe succeeds AND no
 * connect probe manages to connect.
 */
import { createServer, type Socket, connect as netConnect } from "node:net";

/** Error codes meaning "this address family isn't available on this machine". */
const FAMILY_UNAVAILABLE = new Set(["EADDRNOTAVAIL", "EAFNOSUPPORT", "EINVAL"]);

type BindResult = "free" | "taken" | "family-unavailable";

/** Try to bind `port` on one host (specific address or wildcard) and report what happened. */
function probeBind(port: number, host: string): Promise<BindResult> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", (err: NodeJS.ErrnoException) => {
      server.close();
      if (err.code && FAMILY_UNAVAILABLE.has(err.code)) {
        // No IPv6 (or IPv4) support on this machine — nothing to conflict with.
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

type ConnectResult = "occupied" | "free" | "inconclusive";

const CONNECT_PROBE_TIMEOUT_MS = 250;

/**
 * Try to TCP-connect to `host:port` with a short timeout. A successful
 * connection means something is definitely listening there. ECONNREFUSED
 * means nothing is listening (free, for that family). Anything else
 * (timeout, unreachable, family unavailable) is inconclusive and must not be
 * treated as proof of occupation by itself.
 */
function probeConnect(port: number, host: string): Promise<ConnectResult> {
  return new Promise((resolve) => {
    let settled = false;
    let socket: Socket;
    const finish = (result: ConnectResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket = netConnect({ port, host });
    socket.setTimeout(CONNECT_PROBE_TIMEOUT_MS);

    socket.once("connect", () => finish("occupied"));
    socket.once("timeout", () => finish("inconclusive"));
    socket.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ECONNREFUSED") {
        finish("free");
      } else {
        // EHOSTUNREACH, ENETUNREACH, family unavailable, etc. — inconclusive.
        finish("inconclusive");
      }
    });
  });
}

/**
 * Resolve true if `port` is free on every probe: bind-probes on the specific
 * loopback addresses and the wildcard addresses for both families, plus
 * connect-probes to the loopback addresses. False if any bind probe reports
 * "taken" or any connect probe successfully connects.
 */
export async function isPortFree(port: number): Promise<boolean> {
  const [v4Loopback, v6Loopback, v4Wildcard, v6Wildcard, v4Connect, v6Connect] =
    await Promise.all([
      probeBind(port, "127.0.0.1"),
      probeBind(port, "::1"),
      probeBind(port, "0.0.0.0"),
      probeBind(port, "::"),
      probeConnect(port, "127.0.0.1"),
      probeConnect(port, "::1"),
    ]);

  const bindsOk = [v4Loopback, v6Loopback, v4Wildcard, v6Wildcard].every(
    (result) => result !== "taken",
  );
  const noConnectSucceeded = v4Connect !== "occupied" && v6Connect !== "occupied";

  return bindsOk && noConnectSucceeded;
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
