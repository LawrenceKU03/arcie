/**
 * Builds the `@font-face` rule for Inter, with the woff2 embedded as a
 * data: URI.
 *
 * The font is inlined rather than shipped as a sibling file because the
 * stylesheet has no stable base URL: it is inlined into the `<agent-chat>`
 * bundle as a JS string, served from memory by `arcie dev`, copied into
 * static output by `arcie build`, and imported as `arcie/ui/styles.css` by
 * consumers whose bundler decides its own asset paths. A relative `url()`
 * would break in most of those. The data: URI works in all of them and
 * costs one round-trip less.
 *
 * Latin only, upright only — 48 KB of woff2, ~64 KB once base64'd. The
 * other subsets (cyrillic, greek, vietnamese) and the italic face are
 * available in the same package if the tradeoff changes; each adds a
 * comparable chunk. Browsers synthesise an oblique for the rare markdown
 * emphasis in the meantime.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const WOFF2 = resolve(
  root,
  "node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
);

/** Matches the latin subset the woff2 above actually contains. */
const UNICODE_RANGE =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308," +
  "U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";

export function interFontFace() {
  let woff2;
  try {
    woff2 = readFileSync(WOFF2);
  } catch {
    throw new Error(
      `[inter-face] Inter woff2 not found at ${WOFF2}. ` +
        "Run `npm install` — @fontsource-variable/inter is a devDependency.",
    );
  }

  const data = woff2.toString("base64");
  return (
    `@font-face{` +
    `font-family:"Inter Variable";` +
    `font-style:normal;` +
    `font-display:swap;` +
    `font-weight:100 900;` +
    `src:url("data:font/woff2;base64,${data}") format("woff2-variations");` +
    `unicode-range:${UNICODE_RANGE}` +
    `}\n`
  );
}

export const interFontSizeKb = () => readFileSync(WOFF2).length / 1024;
