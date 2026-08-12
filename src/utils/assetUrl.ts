/**
 * Resolve a bundled `public/` asset to a URL that works wherever the
 * app is served from.
 *
 * These paths used to be written root-relative (`/assets/weather/rain.svg`)
 * on the reasoning that the extension root IS the public root - true for
 * chrome-extension://, false the moment the same bundle is served from a
 * subdirectory (the embedded web demo lives at /ghiblify/demo/, so every
 * root-relative asset 404'd against the host site's root).
 *
 * Resolving against `document.baseURI` covers both: it is
 * `chrome-extension://<id>/newtab.html` in the extension and the demo
 * page's own URL on the web, and in both cases the assets sit next to
 * the document. Vite already applies the same rewrite to `url()` in CSS
 * via `base`; this is the JS-side equivalent, needed because plain
 * strings never pass through the bundler.
 */
export const assetUrl = (path: string): string =>
  new URL(String(path).replace(/^\//, ""), document.baseURI).href;
