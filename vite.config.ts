import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path, { join } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Web port precedence mirrors server/config.ts's loadConfig(): config.json is
// authoritative when present (scripts/service/run-web.sh reads webPort from it
// and exports ARELOS_WEB_PORT to match, so the two agree in production);
// ARELOS_WEB_PORT is only a dev-fallback for when there is no installed config
// (a contributor checkout, or CI). Checking the env var first — regardless of
// whether config.json exists — would let a stray env var override an install,
// which is the precedence inversion this mirrors config.ts to avoid.
const CONFIG_PATH = process.env.ARELOS_CONFIG_PATH ?? join(homedir(), ".arelos", "config.json");

function resolveWebPort(): number {
  if (existsSync(CONFIG_PATH)) {
    const parsed = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as { webPort?: number };
    if (typeof parsed.webPort === "number") return parsed.webPort;
  }
  return Number(process.env.ARELOS_WEB_PORT) || 1347;
}

const WEB_PORT = resolveWebPort();

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: WEB_PORT,
    strictPort: true,
  },
  preview: {
    port: WEB_PORT,
    strictPort: true,
  },
});
