import { describe, it, expect } from "vitest";
import { uiEntrySource, uiHtml, UI_ENTRY_FILES } from "../src/cli/build";

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
