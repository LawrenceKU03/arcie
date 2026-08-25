import { defineTool } from "arcie";
import { z } from "zod";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";

const BLOCKED_SEGMENTS = new Set(["node_modules", ".git", ".arcie", "sessions", ".memory"]);

function isProtectedPath(rel: string): boolean {
  const segments = rel.split("/");
  return segments.some((s) => s.startsWith(".env") || BLOCKED_SEGMENTS.has(s));
}

function resolveInside(root: string, rel: string): string {
  const cleaned = rel.replace(/\\/g, "/").replace(/^\/+/, "");
  const abs = resolve(root, cleaned);
  if (abs !== root && !abs.startsWith(root + sep)) {
    throw new Error(`Path escapes the project root: ${rel}`);
  }
  return abs;
}

export default defineTool({
  description:
    "Write or overwrite a file in the project directory, using a relative path from the project root. Use this to fix code, add tools, update instructions, or edit agent files — you can improve yourself. Parent directories are created automatically. Protected paths (.env*, node_modules, .git, .arcie, sessions) are refused. Pauses for approval before writing.",
  inputSchema: z.object({
    path: z.string().describe("Relative path from the project root, e.g. 'agent/tools/new_tool.ts' or 'agent/instructions.md'"),
    content: z.string().describe("The full file content to write"),
  }),
  execute: ({ path, content }) => {
    if (!path || !path.trim()) {
      return { path, written: false, error: "path is required" };
    }

    const projectRoot = process.cwd();
    if (isProtectedPath(path.replace(/^\/+/, ""))) {
      return {
        path,
        written: false,
        error: "Refusing to write to a protected path (.env*, node_modules, .git, .arcie, sessions)",
      };
    }

    let fullPath: string;
    try {
      fullPath = resolveInside(projectRoot, path);
    } catch (err) {
      return { path, written: false, error: err instanceof Error ? err.message : String(err) };
    }

    try {
      const existed = existsSync(fullPath);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, content, "utf-8");
      return {
        path,
        written: true,
        existed,
        bytes: Buffer.byteLength(content),
        message: existed ? "Overwrote existing file" : "Created new file",
      };
    } catch (err) {
      return { path, written: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
  needsApproval: "always",
});
