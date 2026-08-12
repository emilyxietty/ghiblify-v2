/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Whether this build can serve `chrome-extension://<id>/_favicon/`.
 *
 * Only Chromium has that cache, and only when the `favicon` permission
 * is in the manifest - the Firefox build strips it (see
 * scripts/manifest-target.mjs), and the embedded web demo has no
 * manifest at all. Without this check those builds still emit a
 * `_favicon/` URL per link, each 404ing before the chain reaches the
 * remote lookup that actually works there.
 *
 * Evaluated once at module load: the manifest cannot change mid-session.
 */
export const hasFaviconCache = (() => {
  const ns: any = typeof chrome !== "undefined" ? chrome : undefined;
  try {
    return !!ns?.runtime?.getManifest?.()?.permissions?.includes("favicon");
  } catch {
    return false;
  }
})();
