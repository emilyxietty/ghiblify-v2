/**
 * Store-ready archive builder.
 *
 *   node scripts/package.mjs firefox
 *
 * Assumes `dist/` was just built AND patched for the same target (the
 * `package:*` scripts in package.json chain both). Names the archive
 * from the version in the built manifest, so the filename can never
 * disagree with what's inside it.
 *
 * Uses the system `zip` rather than a JS zip library: it's present on
 * macOS and Linux, and this saves a dependency for a script that runs a
 * few times per release. `-X` drops the resource forks and extra
 * attributes that make macOS archives noisy for store validators.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

const target = process.argv[2];
if (!target) {
  console.error("[package] usage: node scripts/package.mjs <chrome|edge|firefox>");
  process.exit(1);
}

const { version } = JSON.parse(
  readFileSync(resolve(dist, "manifest.json"), "utf8")
);
const archive = resolve(root, `ghiblify-${version}-${target}.zip`);

// zip appends to an existing archive rather than replacing it, which
// would quietly preserve files deleted since the last release.
rmSync(archive, { force: true });

execFileSync(
  "zip",
  [
    "-r",
    "-X",
    "-q",
    archive,
    ".",
    // Build byproducts and OS litter that shouldn't ship to a store.
    "-x",
    "*.DS_Store",
    "bundle-stats.html",
    "*.map",
  ],
  { cwd: dist, stdio: "inherit" }
);

console.log(`[package] ${archive.replace(`${root}/`, "")}`);
