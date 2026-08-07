import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { scaffoldPath } from "../src/cli/init";

const TEMPLATE = resolve(__dirname, "../templates/default");

describe("scaffoldPath", () => {
  it("renames the dotless template gitignore", () => {
    expect(scaffoldPath("gitignore")).toBe(".gitignore");
  });

  it("leaves every other path alone", () => {
    expect(scaffoldPath("package.json")).toBe("package.json");
    expect(scaffoldPath("agent/agent.ts")).toBe("agent/agent.ts");
    expect(scaffoldPath("ui/app.tsx")).toBe("ui/app.tsx");
  });

  // Only the exact root entry is the sentinel — a file that merely contains
  // "gitignore" in its name must not be rewritten.
  it("does not rewrite paths that merely contain the name", () => {
    expect(scaffoldPath("agent/knowledge/gitignore.md")).toBe("agent/knowledge/gitignore.md");
    expect(scaffoldPath("docs/gitignore-guide.md")).toBe("docs/gitignore-guide.md");
  });
});

describe("template gitignore", () => {
  // npm strips a nested `.gitignore` out of the published tarball entirely, so
  // shipping it under the dotted name silently produces scaffolds with no
  // gitignore at all. Verified with `npm pack --dry-run`: the dotted name never
  // appears, the dotless one does. This test is the guard against a well-meaning
  // rename putting the dot back.
  it("ships dotless so npm cannot strip it", () => {
    expect(existsSync(resolve(TEMPLATE, "gitignore"))).toBe(true);
    expect(existsSync(resolve(TEMPLATE, ".gitignore"))).toBe(false);
  });

  it("ignores build output and secrets", () => {
    const body = readFileSync(resolve(TEMPLATE, "gitignore"), "utf-8");
    // .arcie holds both `arcie build` output and the dev server's UI bundle.
    expect(body).toMatch(/^\.arcie$/m);
    expect(body).toMatch(/^node_modules$/m);
    expect(body).toMatch(/^\.env\.local$/m);
  });
});
