/**
 * Per-store manifest rewriting.
 * ============================================================================
 *
 * `public/manifest.json` is the CHROME manifest, copied verbatim into
 * `dist/` by Vite. This script runs after the build and patches that
 * copy in place for whichever store the artifact is headed to:
 *
 *   node scripts/manifest-target.mjs chrome | edge | firefox
 *
 * Chrome and Edge are the same manifest - Edge runs Chromium and
 * accepts a Chrome MV3 package unmodified, so its entry here is an
 * identity transform kept only so `build:edge` is a real, nameable
 * command rather than folklore.
 *
 * Firefox is where the differences live. See FIREFOX_NOTES below.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = resolve(root, "dist/manifest.json");

/**
 * The add-on's permanent identity on addons.mozilla.org.
 *
 * Firefox needs this for two reasons: AMO keys every listing by it, and
 * `storage.sync` is *implemented* on top of the add-on ID - without one,
 * the sync-tiered keys in hybridStorage (locale, appearance) silently
 * fail to persist across devices.
 *
 * IT IS PERMANENT ONCE PUBLISHED. Changing it later orphans the listing
 * and every existing user's synced data. Change it BEFORE the first
 * submission or not at all.
 */
const GECKO_ID = "ghiblify@emilyxie.dev";

/**
 * Firefox 140 is the floor, for two independent reasons.
 *
 * From 127 onward Firefox displays `host_permissions` in the install
 * prompt and grants them at install, matching Chrome. Below that they
 * were neither shown nor granted, which would leave the Google suggest
 * endpoint (no CORS headers - it only works with a host grant) failing
 * silently, so the search dropdown would just never appear.
 *
 * From 140 onward Firefox renders the built-in data-consent prompt
 * driven by `data_collection_permissions` below. Older builds ignore
 * that key, which would mean shipping a declaration nobody is shown.
 * 140 is an ESR, so it's a cheap floor that clears both lines at once.
 */
const FIREFOX_MIN = "140.0";

/**
 * What leaves the user's device, in Mozilla's taxonomy.
 *
 * AMO has required this key on new listings since Nov 2025 and drives
 * the install-time consent prompt from it. Two things qualify:
 *
 *   - `locationInfo`  - Weather resolves an approximate location from
 *     the IP via BigDataCloud, then sends coordinates to Open-Meteo.
 *   - `searchTerms`   - the Search widget sends each keystroke to
 *     Google's suggest endpoint to populate the dropdown.
 *
 * Bookmarks are deliberately NOT listed: the widget reads them through
 * the local API and never transmits them, and this key describes
 * transmission, not access. The API-permission prompt already covers
 * the read.
 *
 * Both are declared `required` rather than `optional` because nothing
 * in the app checks a runtime data grant before fetching - an
 * `optional` declaration would promise a gate that doesn't exist.
 */
const DATA_COLLECTION = { required: ["locationInfo", "searchTerms"] };

/**
 * Permissions Chrome understands and Firefox does not.
 *
 * `favicon` gates Chrome's `chrome-extension://<id>/_favicon/` cache.
 * Firefox has no equivalent and AMO's validator flags the unknown
 * string. Dropping it costs nothing: `Favicon.tsx` walks a candidate
 * chain and already falls through to Google's s2 endpoint, and it reads
 * the manifest at runtime so it skips the `_favicon` attempts entirely
 * when the permission isn't there.
 */
const CHROME_ONLY_PERMISSIONS = ["favicon"];

const TARGETS = {
  chrome: (m) => m,
  edge: (m) => m,
  firefox: (m) => ({
    ...m,
    permissions: m.permissions.filter(
      (p) => !CHROME_ONLY_PERMISSIONS.includes(p)
    ),
    browser_specific_settings: {
      gecko: {
        id: GECKO_ID,
        strict_min_version: FIREFOX_MIN,
        data_collection_permissions: DATA_COLLECTION,
      },
    },
  }),
};

const target = process.argv[2];
const transform = TARGETS[target];
if (!transform) {
  console.error(
    `[manifest] unknown target "${target ?? ""}" - expected one of: ${Object.keys(
      TARGETS
    ).join(", ")}`
  );
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
} catch (err) {
  console.error(
    `[manifest] could not read ${MANIFEST} - run the build first.\n`,
    err.message
  );
  process.exit(1);
}

writeFileSync(MANIFEST, `${JSON.stringify(transform(manifest), null, 2)}\n`);
console.log(`[manifest] dist/manifest.json patched for ${target}`);
