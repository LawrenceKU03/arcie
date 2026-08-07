import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { uiEntrySource, uiHtml, UI_ENTRY_FILES, resolveUiSources } from "../src/cli/ui-build";

describe("uiEntrySource", () => {
  it("mounts the project's app component", () => {
    const src = uiEntrySource("./ui/app", null);
    expect(src).toContain(`import App from "./ui/app";`);
    expect(src).toContain(`createRoot(container).render(<App />);`);
    expect(src).toContain(`import "arcie/ui/styles.css";`);
  });

  it("omits all theme code when there is no theme module", () => {
    const src = uiEntrySource("./ui/app", null);
    expect(src).not.toMatch(/theme/);
    // A bare `Object.entries(undefined)` would throw at mount time.
    expect(src).not.toContain("Object.entries");
  });

  it("applies theme tokens as CSS variables when a theme module exists", () => {
    const src = uiEntrySource("./ui/app", "./ui/theme");
    expect(src).toContain(`import theme from "./ui/theme";`);
    expect(src).toContain("Object.entries(theme ?? {})");
  });

  // The kit scopes its design tokens to `.agent-chat-root`, not `:root`.
  // Overriding on `:root` would silently fail to theme anything.
  it("scopes overrides to the kit's themed root", () => {
    const src = uiEntrySource("./ui/app", "./ui/theme");
    expect(src).toContain(".agent-chat-root{");
    expect(src).not.toContain(":root{");
  });

  it("fails loudly when the host page has no mount point", () => {
    expect(uiEntrySource("./ui/app", null)).toContain("#root not found");
  });
});

describe("uiHtml", () => {
  it("references the emitted bundle and stylesheet", () => {
    const html = uiHtml("my-agent");
    expect(html).toContain(`<script type="module" src="./app.js">`);
    expect(html).toContain(`<link rel="stylesheet" href="./app.css" />`);
    expect(html).toContain(`<div id="root"></div>`);
  });

  it("uses the agent name as the page title", () => {
    expect(uiHtml("support-bot")).toContain("<title>support-bot</title>");
  });

  // The name comes from agent config, which is author-controlled but ends up
  // in HTML — escape it rather than letting it close the title element.
  it("escapes the title", () => {
    const html = uiHtml(`</title><script>alert(1)</script>`);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;/title&gt;");
  });
});

describe("UI_ENTRY_FILES", () => {
  it("prefers the TypeScript entry", () => {
    expect(UI_ENTRY_FILES[0]).toBe("app.tsx");
    expect(UI_ENTRY_FILES).toContain("app.jsx");
  });
});

describe("uiHtml live reload", () => {
  it("is absent by default — production output must not poll a dev server", () => {
    const html = uiHtml("agent");
    expect(html).not.toContain("EventSource");
    expect(html).not.toContain("_arcie/dev");
  });

  it("subscribes to the dev reload channel when requested", () => {
    const html = uiHtml("agent", { liveReload: true });
    expect(html).toContain(`new EventSource("/_arcie/dev")`);
    expect(html).toContain("location.reload()");
  });
});

describe("resolveUiSources", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "arcie-ui-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const writeUi = (files: Record<string, string>) => {
    mkdirSync(join(root, "ui"), { recursive: true });
    for (const [name, body] of Object.entries(files)) {
      writeFileSync(join(root, "ui", name), body);
    }
  };

  // No ui/ is the zero-config path, not an error: the default chat page serves.
  it("returns null when the project has no ui/", () => {
    expect(resolveUiSources(root)).toBeNull();
  });

  it("resolves the entry without a theme", () => {
    writeUi({ "app.tsx": "export default () => null;" });
    expect(resolveUiSources(root)).toEqual({
      entryImport: "./ui/app",
      themeImport: null,
    });
  });

  it("resolves the theme when present", () => {
    writeUi({ "app.tsx": "export default () => null;", "theme.ts": "export default {};" });
    expect(resolveUiSources(root)?.themeImport).toBe("./ui/theme");
  });

  it("accepts a .jsx entry", () => {
    writeUi({ "app.jsx": "export default () => null;" });
    expect(resolveUiSources(root)?.entryImport).toBe("./ui/app");
  });

  // A ui/ with no entry is a mistake worth surfacing — treating it as "no
  // frontend" would silently ship the default page instead of the user's.
  it("throws when ui/ exists but has no entry", () => {
    mkdirSync(join(root, "ui"), { recursive: true });
    expect(() => resolveUiSources(root)).toThrow(/no app\.tsx or app\.jsx/);
  });

  it("strips only the extension, not part of the name", () => {
    writeUi({ "app.tsx": "export default () => null;" });
    expect(resolveUiSources(root)?.entryImport).not.toContain(".tsx");
  });
});
