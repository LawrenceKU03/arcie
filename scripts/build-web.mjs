#!/usr/bin/env node
/**
 * Builds the standalone `<agent-chat>` web component:
 *
 *   1. Tailwind compiles web/src/styles.css → web/.gen/agent-chat.css
 *      (tree-shaken to the classes the ported chat UI actually uses).
 *   2. esbuild bundles web/src/element.tsx (React + all UI deps + the CSS
 *      inlined as text) → dist/web/agent-chat.js, an IIFE that registers the
 *      <agent-chat> custom element and is usable via a plain <script> tag.
 *
 * The bundle ships in the `arcie` package (dist/) and is also exported as the
 * `arcie/web` subpath. No Next.js, no framework shell.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, copyFileSync, existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const genDir = resolve(root, "web/.gen");
const genCss = resolve(genDir, "agent-chat.css");
const distDir = resolve(root, "dist/web");

mkdirSync(genDir, { recursive: true });
mkdirSync(distDir, { recursive: true });

// ── 1. Tailwind → CSS ────────────────────────────────────────────────────
const tw = spawnSync(
  "npx",
  [
    "tailwindcss",
    "-c", "web/tailwind.config.cjs",
    "-i", "web/src/styles.css",
    "-o", "web/.gen/agent-chat.css",
    "--minify",
  ],
  { cwd: root, stdio: "inherit", env: process.env },
);
if (tw.status !== 0) {
  console.error("[build-web] tailwind failed");
  process.exit(tw.status ?? 1);
}
if (!existsSync(genCss)) {
  console.error("[build-web] tailwind produced no CSS at", genCss);
  process.exit(1);
}

// ── 2. esbuild bundle ────────────────────────────────────────────────────
await esbuild.build({
  entryPoints: [resolve(root, "web/src/element.tsx")],
  outfile: resolve(distDir, "agent-chat.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  jsx: "automatic",
  minify: true,
  sourcemap: false,
  loader: { ".css": "text" },
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "info",
});

// Also ship the raw stylesheet for consumers who prefer a <link>.
copyFileSync(genCss, resolve(distDir, "agent-chat.css"));

const size = statSync(resolve(distDir, "agent-chat.js")).size;
console.log(`[build-web] dist/web/agent-chat.js  ${(size / 1024).toFixed(0)} KB`);
