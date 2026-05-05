import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";
import { visualizer } from "rollup-plugin-visualizer";

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
    visualizer({
      filename: "dist/bundle-stats.html",
      gzipSize: true,
      brotliSize: true,
      template: "treemap",
    }),
  ],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        newtab: resolve(__dirname, "newtab.html"),
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
