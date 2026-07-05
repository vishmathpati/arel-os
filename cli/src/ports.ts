/**
 * Zero-dependency free-port detection via node:net (spec §1 Step 5).
 */
import { createServer } from "node:net";

/** Resolve true if `port` is free to bind on 127.0.0.1, false if taken. */
export function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", (err: NodeJS.ErrnoException) => {
      server.close();
      if (err.code === "EADDRINUSE" || err.code === "EACCES") {
        resolve(false);
      } else {
        // Unexpected error probing the port — treat conservatively as taken
        // so we never suggest a port we can't actually validate.
        resolve(false);
      }
    });
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
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
