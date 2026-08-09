import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AVAILABLE_TOOLS, DEFAULT_TOOLS, pruneInstructions } from "../src/cli/init";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "arcie-init-"));
  mkdirSync(join(root, "agent"), { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const INSTRUCTIONS = `# Agent

### Code & Filesystem
- **file_reader** — Read files or list directories in the project.
- **grep** — Search file contents with regex patterns.
- **write_file** — Write or edit any file in the project.
- **execute_command** — Run shell commands in the project.

### Self-improvement
When the user asks you to change something in the project, do it yourself:
1. Read the relevant files first (**file_reader**, **grep**).
2. Make the edit with **write_file**.

**write_file** and **execute_command** pause for approval before they act.

### Math & Data
- **calculator** — Evaluate math expressions.
`;

function writeInstructions(): string {
  const path = join(root, "agent/instructions.md");
  writeFileSync(path, INSTRUCTIONS);
  return path;
}

const ids = (entries: typeof AVAILABLE_TOOLS) => entries.map((t) => t.id);

describe("AVAILABLE_TOOLS", () => {
  // These were reachable by neither the picker nor the removal loop, so they
  // shipped in every scaffold regardless of what the user chose.
  it("offers the host-access tools so they can be declined", () => {
    expect(ids(AVAILABLE_TOOLS)).toContain("write_file");
    expect(ids(AVAILABLE_TOOLS)).toContain("execute_command");
  });

  it("marks exactly the host-access tools sensitive", () => {
    expect(ids(AVAILABLE_TOOLS.filter((t) => t.sensitive))).toEqual([
      "write_file",
      "execute_command",
    ]);
  });
});

describe("DEFAULT_TOOLS", () => {
  it("excludes host access from 'All tools'", () => {
    expect(ids(DEFAULT_TOOLS)).not.toContain("write_file");
    expect(ids(DEFAULT_TOOLS)).not.toContain("execute_command");
  });

  it("keeps every non-sensitive tool", () => {
    expect(DEFAULT_TOOLS).toHaveLength(AVAILABLE_TOOLS.length - 2);
    expect(ids(DEFAULT_TOOLS)).toContain("calculator");
    expect(ids(DEFAULT_TOOLS)).toContain("researcher");
  });
});

describe("pruneInstructions", () => {
  it("drops bullets for tools that were not installed", () => {
    const path = writeInstructions();
    pruneInstructions(root, new Set(ids(DEFAULT_TOOLS)));
    const out = readFileSync(path, "utf-8");

    expect(out).not.toMatch(/write_file/);
    expect(out).not.toMatch(/execute_command/);
    expect(out).toMatch(/- \*\*file_reader\*\*/);
    expect(out).toMatch(/- \*\*calculator\*\*/);
  });

  it("drops the self-improvement workflow when either half is missing", () => {
    const path = writeInstructions();
    pruneInstructions(root, new Set(["file_reader", "grep", "calculator", "write_file"]));
    const out = readFileSync(path, "utf-8");

    expect(out).not.toMatch(/### Self-improvement/);
    expect(out).toMatch(/### Math & Data/);
  });

  it("keeps the workflow when both halves are installed", () => {
    const path = writeInstructions();
    pruneInstructions(root, new Set(ids(AVAILABLE_TOOLS)));
    const out = readFileSync(path, "utf-8");

    expect(out).toMatch(/### Self-improvement/);
    expect(out).toMatch(/write_file/);
  });

  it("leaves the file untouched when everything is selected", () => {
    const path = writeInstructions();
    pruneInstructions(root, new Set(ids(AVAILABLE_TOOLS)));
    expect(readFileSync(path, "utf-8")).toBe(INSTRUCTIONS);
  });

  it("preserves surrounding sections and collapses blank runs", () => {
    const path = writeInstructions();
    pruneInstructions(root, new Set(ids(DEFAULT_TOOLS)));
    const out = readFileSync(path, "utf-8");

    expect(out).toMatch(/### Code & Filesystem/);
    expect(out).toMatch(/### Math & Data/);
    expect(out).not.toMatch(/\n{3,}/);
  });

  it("is a no-op when there is no instructions.md", () => {
    expect(() => pruneInstructions(root, new Set(["calculator"]))).not.toThrow();
  });
});
