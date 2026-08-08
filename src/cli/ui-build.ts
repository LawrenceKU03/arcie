/**
 * Shared compilation logic for a project's `ui/` directory.
 *
 * `arcie build` compiles it once to static assets; `arcie dev` compiles it in
 * watch mode and serves it. Both go through here so the frontend a developer
 * sees locally is built the same way as the one that ships.
 */
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Accepted filenames for the UI root component, in resolution order. */
export const UI_ENTRY_FILES = ["app.tsx", "app.jsx"];

/** Accepted filenames for the optional design-token module. */
export const UI_THEME_FILES = ["theme.ts", "theme.js"];

/** Filename used by generated host pages and static UI bundles. */
export const UI_FAVICON_FILE = "favicon.ico";

/** Asset hash keeps browsers from reusing a cached missing/default favicon. */
export const UI_FAVICON_HREF = `${UI_FAVICON_FILE}?v=9ff48ef2`;

/**
 * Finds Arcie's bundled Cencori favicon from both source and compiled layouts.
 * Published CLI chunks can sit several directories below the package root, so
 * resolve it the same way runtime bundle assets are located elsewhere.
 */
export function resolveBundledUiFavicon(): string {
  let current = dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = resolve(current, "assets", UI_FAVICON_FILE);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error(`[arcie] bundled ${UI_FAVICON_FILE} not found`);
}

/** Copies the bundled favicon beside a generated host page. */
export function copyBundledUiFavicon(outDir: string): void {
  copyFileSync(resolveBundledUiFavicon(), join(outDir, UI_FAVICON_FILE));
}

export interface UiSources {
  /** Import specifier for the root component, relative to the project root. */
  entryImport: string;
  /** Import specifier for the theme module, or null when there isn't one. */
  themeImport: string | null;
}

/**
 * Locates `ui/app.*` and the optional `ui/theme.*`.
 *
 * Returns null when the project has no `ui/` at all — the zero-config path,
 * where the default chat page serves. Throws when `ui/` exists but has no
 * recognisable entry, which is a mistake worth surfacing rather than silently
 * treating as "no frontend".
 */
export function resolveUiSources(projectRoot: string): UiSources | null {
  const uiDir = join(projectRoot, "ui");
  if (!existsSync(uiDir)) return null;

  const entryFile = UI_ENTRY_FILES.find((f) => existsSync(join(uiDir, f)));
  if (!entryFile) {
    throw new Error(
      `ui/ has no ${UI_ENTRY_FILES.join(" or ")} — add one, or remove ui/ to use the default chat page`,
    );
  }

  const themeFile = UI_THEME_FILES.find((f) => existsSync(join(uiDir, f)));
  const stripExt = (f: string) => f.replace(/\.[jt]sx?$/, "");

  return {
    entryImport: `./ui/${stripExt(entryFile)}`,
    themeImport: themeFile ? `./ui/${stripExt(themeFile)}` : null,
  };
}

/**
 * The generated entry that mounts the project's `ui/app` into the page.
 *
 * When `ui/theme` is present its tokens are written as CSS custom properties
 * on `.agent-chat-root` — the element `<AgentChat>` renders and the kit's
 * stylesheet scopes its variables to. Overriding there rather than on `:root`
 * is what lets a themed app and an embedded `<agent-chat>` widget coexist on
 * one page without fighting.
 */
export function uiEntrySource(entryImport: string, themeImport: string | null): string {
  return [
    `import { createRoot } from "react-dom/client";`,
    `import App from "${entryImport}";`,
    themeImport ? `import theme from "${themeImport}";` : null,
    `import "arcie/ui/styles.css";`,
    ``,
    themeImport
      ? [
          `const vars = Object.entries(theme ?? {})`,
          `  .map(([key, value]) => "--" + key + ":" + value + ";")`,
          `  .join("");`,
          `if (vars) {`,
          `  const style = document.createElement("style");`,
          `  style.textContent = ".agent-chat-root{" + vars + "}";`,
          `  document.head.appendChild(style);`,
          `}`,
          ``,
        ].join("\n")
      : null,
    `const container = document.getElementById("root");`,
    `if (!container) throw new Error("[arcie] #root not found in the host page");`,
    `createRoot(container).render(<App />);`,
    ``,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/** SSE client that reloads the page when the dev server finishes a rebuild. */
const LIVE_RELOAD_SCRIPT = `<script>
      new EventSource("/_arcie/dev").onmessage = (e) => {
        if (e.data === "reload") location.reload();
      };
    </script>`;

/** The host page for the compiled UI. Kept minimal — the app owns the rest. */
export function uiHtml(title: string, options: { liveReload?: boolean } = {}): string {
  const safeTitle = title.replace(/[<>&"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!,
  );
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <link rel="icon" href="./${UI_FAVICON_HREF}" sizes="48x48" type="image/x-icon" />
    <link rel="stylesheet" href="./app.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./app.js"></script>${options.liveReload ? `\n    ${LIVE_RELOAD_SCRIPT}` : ""}
  </body>
</html>
`;
}

/**
 * esbuild options shared by both callers. `development` keeps the bundle
 * readable and adds sourcemaps; `production` minifies.
 */
export function uiBuildOptions(
  projectRoot: string,
  sources: UiSources,
  outfile: string,
  mode: "development" | "production",
): import("esbuild").BuildOptions {
  return {
    stdin: {
      contents: uiEntrySource(sources.entryImport, sources.themeImport),
      resolveDir: projectRoot,
      sourcefile: "arcie-ui-entry.tsx",
      loader: "tsx",
    },
    bundle: true,
    platform: "browser",
    format: "esm",
    target: "es2022",
    jsx: "automatic",
    minify: mode === "production",
    sourcemap: mode === "development",
    outfile,
    // React's ESM build branches on NODE_ENV; without this the bundle throws
    // "process is not defined" the moment it runs in a browser.
    define: {
      "process.env.NODE_ENV": mode === "production" ? '"production"' : '"development"',
    },
    logLevel: "silent",
  };
}
