/**
 * Public runtime config (portability contract §4). Fetches `GET /config` from
 * the vault server once at boot and exposes `displayName` for the sidebar
 * header and document title. Falls back to "Arel OS" if the fetch fails, so
 * the app stays coherent when the vault server is briefly unreachable.
 */

import { VAULT_API } from "@/shared/lib/vault/base-url";
import { useEffect, useState } from "react";

export interface PublicConfig {
  displayName: string;
  vaultPort: number;
}

const DEFAULT_CONFIG: PublicConfig = { displayName: "Arel OS", vaultPort: 5274 };

export function usePublicConfig(): PublicConfig {
  const [cfg, setCfg] = useState<PublicConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    let cancelled = false;
    fetch(`${VAULT_API}/config`)
      .then((r) => r.json())
      .then((c: PublicConfig) => {
        if (cancelled) return;
        setCfg(c);
        document.title = c.displayName;
      })
      .catch(() => {
        /* keep fallback */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return cfg;
}
