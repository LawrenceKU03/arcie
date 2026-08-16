#!/usr/bin/env node
/**
 * Compiles the Arcie UI kit stylesheet: web/src/styles.css → dist/ui/styles.css.
 *
 * The `arcie/ui` components are the same ones the <agent-chat> web component
 * bundles, so they share one Tailwind theme (web/tailwind.config.cjs, which
 * scans all of web/src). Consumers of the kit import `arcie/ui/styles.css`
 * once, alongside the components. See UI_STANDARD.md.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, existsSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { interFontFace } from "./inter-face.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outCss = resolve(root, "dist/ui/styles.css");

mkdirSync(dirname(outCss), { recursive: true });

const tw = spawnSync(
  "npx",
  [
    "tailwindcss",
    "-c", "web/tailwind.config.cjs",
    "-i", "web/src/styles.css",
    "-o", "dist/ui/styles.css",
    "--minify",
  ],
  { cwd: root, stdio: "inherit", env: process.env },
);
if (tw.status !== 0) {
  console.error("[build-ui-css] tailwind failed");
  process.exit(tw.status ?? 1);
}
if (!existsSync(outCss)) {
  console.error("[build-ui-css] tailwind produced no CSS at", outCss);
  process.exit(1);
}

// Inter travels inside the stylesheet as a data: URI — consumers import
// `arcie/ui/styles.css` and get the font with it, no asset wiring.
writeFileSync(outCss, interFontFace() + readFileSync(outCss, "utf-8"));

const size = statSync(outCss).size;
console.log(`[build-ui-css] dist/ui/styles.css  ${(size / 1024).toFixed(0)} KB`);
