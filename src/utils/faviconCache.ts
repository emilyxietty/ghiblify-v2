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

/** The `_favicon/` URL for one page, or null on builds without the cache. */
export const faviconCacheUrl = (pageUrl: string, size: number): string | null => {
  const ns: any = typeof chrome !== "undefined" ? chrome : undefined;
  if (!hasFaviconCache || !ns?.runtime?.getURL) return null;
  try {
    const url = new URL(ns.runtime.getURL("/_favicon/"));
    url.searchParams.set("pageUrl", pageUrl);
    url.searchParams.set("size", String(size));
    return url.toString();
  } catch {
    return null;
  }
};

export const isFaviconCacheUrl = (src: string): boolean =>
  src.includes("/_favicon/");

const pixelsOf = (img: HTMLImageElement): string | null => {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx || !canvas.width) return null;
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL();
  } catch {
    return null;
  }
};

// A miss in the cache is not an error: `_favicon/` answers 200 with the
// browser's generic globe, so an <img> chain never falls through to the
// remote lookup. Fetching a page that cannot be in the cache yields that
// globe once per size, to compare real answers against.
const placeholders = new Map<number, Promise<string | null>>();

const placeholderFor = (size: number): Promise<string | null> => {
  let pending = placeholders.get(size);
  if (!pending) {
    pending = new Promise((resolve) => {
      const src = faviconCacheUrl("https://ghiblify.invalid/", size);
      if (!src) return resolve(null);
      const img = new Image();
      img.onload = () => resolve(pixelsOf(img));
      img.onerror = () => resolve(null);
      img.src = src;
    });
    placeholders.set(size, pending);
  }
  return pending;
};

/** Whether a loaded `_favicon/` image is the browser's generic globe. */
export const isPlaceholderFavicon = async (
  img: HTMLImageElement,
  size: number,
): Promise<boolean> => {
  const placeholder = await placeholderFor(size);
  return placeholder !== null && pixelsOf(img) === placeholder;
};
