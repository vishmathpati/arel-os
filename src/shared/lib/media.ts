/**
 * Resolve a capture media reference to a displayable `<img>`/`<video>` src.
 *
 * Downloaded media (X avatars/images) are stored vault-relative (`media/x.jpg`)
 * and served by the vault server at `/media/<file>`; remote media (YouTube
 * thumbnails) are kept as absolute URLs and pass through untouched (D33).
 */

import { VAULT_API as BASE_URL } from "@/shared/lib/vault/base-url";

/** Absolute http(s)/data/blob URL, or a vault-relative path → server URL. */
export function mediaSrc(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  return `${BASE_URL}/${url.replace(/^\/+/, "")}`;
}
