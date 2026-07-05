import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Web port comes from config (server/config.ts) via ARELOS_WEB_PORT, exported
// by scripts/service/run-web.sh; 1347 is the dev-checkout fallback. `preview`
// (production serving) and `server` (vite dev) share one port so there is
// only ever one configured web port, not two.
const WEB_PORT = Number(process.env.ARELOS_WEB_PORT) || 1347;

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
