import { defineTool } from "arcie";
import { z } from "zod";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";

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
    "Read files from the project directory. Use this when the user asks about the codebase, wants to inspect agent configuration, check what tools exist, or understand the project structure.",
  inputSchema: z.object({
    path: z.string().describe("Relative path from the project root, e.g. 'agent/agent.ts', 'package.json', 'agent/tools/'"),
  }),
  execute: ({ path }) => {
    const projectRoot = process.cwd();

    let fullPath: string;
    try {
      fullPath = resolveInside(projectRoot, path);
    } catch (err) {
      return { path, error: err instanceof Error ? err.message : String(err), exists: false };
    }

    if (!existsSync(fullPath)) {
      return { path, error: `File or directory not found: ${path}`, exists: false };
    }

    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      const entries = readdirSync(fullPath).filter((e) => !e.startsWith(".") && e !== "node_modules");
      const listing = entries.map((e) => {
        const sub = statSync(`${fullPath}/${e}`);
        return `${sub.isDirectory() ? "📁" : "📄"} ${e}${sub.isDirectory() ? "/" : ""}`;
      });
      return { path, type: "directory", entries: listing, exists: true };
    }

    const maxSize = 100_000;
    if (stat.size > maxSize) {
      return {
        path,
        type: "file",
        size: stat.size,
        error: `File too large to read (${(stat.size / 1024).toFixed(0)}KB, max ${maxSize / 1024}KB)`,
        exists: true,
      };
    }

    const content = readFileSync(fullPath, "utf-8");
    return { path, type: "file", size: stat.size, content, exists: true };
  },
});
