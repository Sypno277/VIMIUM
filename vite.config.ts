import { defineConfig, build as viteBuild, type Plugin } from "vite";
import { resolve } from "node:path";

// Multi-entry build for a Manifest V3 extension.
// - background: service worker (ESM)
// - options: full HTML page (options UI)
// - content: self-contained IIFE script without ES module imports so it executes
//   in classic script context in Brave, Chrome, and other Chromium browsers.
//
// D19: sourcemaps are a development aid only. A packaged extension has no
// business shipping `.map` files, so production builds emit none.

/** Sourcemaps only for `vite build --mode development`. */
function wantsSourcemap(mode: string): boolean {
  return mode === "development";
}

function contentScriptPlugin(mode: string): Plugin {
  return {
    name: "vite-plugin-content-script",
    async writeBundle() {
      await viteBuild({
        configFile: false,
        build: {
          outDir: resolve(__dirname, "dist"),
          emptyOutDir: false,
          target: "es2022",
          sourcemap: wantsSourcemap(mode),
          lib: {
            entry: resolve(__dirname, "src/content/content-controller.ts"),
            formats: ["iife"],
            name: "KestrelContent",
            fileName: () => "assets/content.js",
          },
        },
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  root: "src",
  plugins: [contentScriptPlugin(mode)],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    target: "es2022",
    sourcemap: wantsSourcemap(mode),
    rollupOptions: {
      input: {
        background: resolve(__dirname, "src/background/service-worker.ts"),
        options: resolve(__dirname, "src/options/options.html"),
      },
      output: {
        // Flatten so manifest paths stay simple (e.g. assets/background.js)
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
}));
