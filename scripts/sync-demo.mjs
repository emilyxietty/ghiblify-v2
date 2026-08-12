#!/usr/bin/env node
/**
 * Copy the web-demo build into the portfolio site.
 *
 *   BUILD_TARGET=web vite build && node scripts/sync-demo.mjs [siteRepo]
 *
 * Destination defaults to ../emilyxietty.github.io/ghiblify/demo and can
 * be overridden by argv[2] or GHIBLIFY_SITE_DIR. The destination is
 * wiped first so a rename in the build can't leave a stale file behind
 * that the demo would still happily serve.
 *
 * Extension-only artifacts (manifest.json, _locales, icons) are skipped:
 * publicDir copies them into every build, but nothing on the web reads
 * them, and a stray manifest.json in a site subdirectory is just
 * confusing.
 */
import { cp, mkdir, readdir, rm, stat } from "fs/promises";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "dist-demo");
const dest = resolve(
  process.argv[2] ??
    process.env.GHIBLIFY_SITE_DIR ??
    join(root, "..", "emilyxietty.github.io", "ghiblify", "demo")
);

const SKIP = new Set(["manifest.json", "_locales", "bundle-stats.html"]);

try {
  await stat(src);
} catch {
  console.error(`[sync-demo] no build at ${src} - run \`pnpm build:demo\` first`);
  process.exit(1);
}

await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });

let files = 0;
for (const entry of await readdir(src)) {
  if (SKIP.has(entry)) continue;
  await cp(join(src, entry), join(dest, entry), { recursive: true });
  files++;
}

console.log(`[sync-demo] copied ${files} entries -> ${dest}`);
