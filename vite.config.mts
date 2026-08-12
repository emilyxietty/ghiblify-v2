import react from "@vitejs/plugin-react";
import { existsSync, readFileSync, renameSync } from "fs";
import { resolve } from "path";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";
import { visualizer } from "rollup-plugin-visualizer";

// Two build targets from one source tree:
//
//   (default)        - the extension. dist/, absolute asset paths,
//                      newtab + options entries, manifest.json.
//   BUILD_TARGET=web - the embeddable demo. dist-demo/, RELATIVE asset
//                      paths (it is served from a subdirectory of a
//                      portfolio site, not from an extension root), a
//                      single demo.html entry whose module installs a
//                      fake `chrome` namespace before the app boots.
//
// See src/demo/chromeShim.ts for what the web target fakes and why.
const web = process.env.BUILD_TARGET === "web";
const version = JSON.parse(
  readFileSync(resolve(__dirname, "package.json"), "utf8")
).version as string;

// Bundle-size treemap, written to dist/bundle-stats.html. Opt-in via
// `ANALYZE=1 pnpm build`: the plugin reads its chart template through
// `import.meta.dirname`, which only exists on Node >= 20.11, and it
// throws from generateBundle on older runtimes - i.e. an analysis-only
// tool was failing the entire build (nothing gets written to dist/) for
// anyone on Node 18. Needing the numbers is rare; shipping the
// extension is not.
const [nodeMajor, nodeMinor] = process.versions.node.split(".").map(Number);
const canAnalyze = nodeMajor > 20 || (nodeMajor === 20 && nodeMinor >= 11);
const analyze = process.env.ANALYZE === "1" && canAnalyze;
if (process.env.ANALYZE === "1" && !canAnalyze)
  console.warn(
    `[build] ANALYZE=1 ignored: rollup-plugin-visualizer needs Node >= 20.11 ` +
      `(running ${process.versions.node}). Building without bundle stats.`
  );

export default defineConfig({
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        exportType: "named",
        ref: true,
        svgo: false,
        titleProp: true,
      },
      include: "**/*.svg",
    }),
    // Rollup names an HTML output after its source file, so the demo
    // entry would land at dist-demo/demo.html. Renaming it to
    // index.html makes the folder directly embeddable - the iframe can
    // point at the directory, and the site keeps a clean URL.
    ...(web
      ? [
          {
            name: "demo-html-as-index",
            apply: "build" as const,
            // closeBundle, not generateBundle: vite's own HTML plugin
            // adds demo.html to the bundle after this plugin's
            // generateBundle runs, so renaming there is a no-op.
            closeBundle() {
              const built = resolve(__dirname, "dist-demo", "demo.html");
              if (!existsSync(built)) return;
              renameSync(built, resolve(__dirname, "dist-demo", "index.html"));
            },
          },
        ]
      : []),
    ...(analyze
      ? [
          visualizer({
            filename: "dist/bundle-stats.html",
            gzipSize: true,
            brotliSize: true,
            template: "treemap",
          }),
        ]
      : []),
  ],
  base: web ? "./" : "/",
  define: web ? { __DEMO_VERSION__: JSON.stringify(version) } : {},
  build: {
    modulePreload: {
      resolveDependencies: (_filename, deps, context) =>
        context.hostType === "html" ? [] : deps,
    },
    outDir: web ? "dist-demo" : "dist",
    rollupOptions: {
      input: web
        ? // Named `index` so the built page lands at dist-demo/index.html
          // and the embed can point an <iframe> at the directory.
          { index: resolve(__dirname, "demo.html") }
        : {
            newtab: resolve(__dirname, "newtab.html"),
            // Toolbar popup — separate React app at options.html.
            // Shares modules (Icons, React) with newtab via Rollup's
            // chunk splitting, so the dist stays lean.
            options: resolve(__dirname, "options.html"),
          },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
      },
    },
  },
  publicDir: "public",
});
