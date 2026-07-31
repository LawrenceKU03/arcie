import { defineConfig } from "tsup";

// The Arcie UI kit (`arcie/ui`). A browser/React build, separate from the
// node-platform main build (tsup.config.ts). React is a peer dependency;
// everything else is bundled. See UI_STANDARD.md.
export default defineConfig({
  entry: { "ui/index": "web/src/ui/index.ts" },
  format: ["esm"],
  target: "es2022",
  platform: "browser",
  outDir: "dist",
  tsconfig: "tsconfig.ui.json",
  dts: true,
  clean: false,
  sourcemap: true,
  external: ["react", "react-dom", "react/jsx-runtime", "react-dom/client"],
  esbuildOptions(o) {
    o.jsx = "automatic";
  },
});
