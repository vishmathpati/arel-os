/**
 * Single source of truth for the vault server's base URL on the frontend.
 * Build-time only: `VITE_VAULT_API` is baked in by scripts/service/run-web.sh
 * from `~/.arelos/config.json`'s `vaultPort` (see the portability contract).
 * The `http://localhost:5274` fallback only fires in an unconfigured dev
 * checkout — production always sets VITE_VAULT_API at build.
 */
export const VAULT_API: string = import.meta.env.VITE_VAULT_API ?? "http://localhost:5274";
