import { defineTool } from "arcie";
import { z } from "zod";
import { spawn } from "node:child_process";

const MAX_OUTPUT = 20_000;
const DEFAULT_TIMEOUT_SECONDS = 60;
const MAX_TIMEOUT_SECONDS = 300;

interface CommandResult {
  command: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
}

function runCommand(command: string, cwd: string, timeoutMs: number): Promise<CommandResult> {
  return new Promise((resolve) => {
    const started = Date.now();
    let stdout = "";
    let stderr = "";
    let stdoutTruncated = false;
    let stderrTruncated = false;
    let timedOut = false;

    const child = spawn(command, { cwd, shell: true, env: process.env, detached: true });

    child.stdout?.on("data", (chunk: Buffer) => {
      if (stdoutTruncated) return;
      const text = chunk.toString("utf-8");
      const remaining = MAX_OUTPUT - stdout.length;
      if (text.length > remaining) {
        stdout += text.slice(0, remaining);
        stdoutTruncated = true;
      } else {
        stdout += text;
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      if (stderrTruncated) return;
      const text = chunk.toString("utf-8");
      const remaining = MAX_OUTPUT - stderr.length;
      if (text.length > remaining) {
        stderr += text.slice(0, remaining);
        stderrTruncated = true;
      } else {
        stderr += text;
      }
    });

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        process.kill(-child.pid!, "SIGTERM");
      } catch {
        /* process already gone */
      }
    }, timeoutMs);

    child.on("error", () => {
      clearTimeout(timer);
      resolve({
        command,
        exitCode: null,
        timedOut,
        durationMs: Date.now() - started,
        stdout,
        stderr,
        stdoutTruncated,
        stderrTruncated,
      });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        command,
        exitCode: code,
        timedOut,
        durationMs: Date.now() - started,
        stdout,
        stderr,
        stdoutTruncated,
        stderrTruncated,
      });
    });
  });
}

export default defineTool({
  description:
    "Run a shell command in the project directory (cwd = project root). Use this to install packages, run tests, run the build, execute scripts, or verify your own changes. The environment is inherited. Output is truncated at 20,000 characters. Pauses for approval before running.",
  inputSchema: z.object({
    command: z.string().describe("The shell command to run, e.g. 'npm test' or 'node scripts/build.mjs'"),
    timeoutSeconds: z
      .number()
      .optional()
      .default(DEFAULT_TIMEOUT_SECONDS)
      .describe(`Maximum time to wait in seconds (1-${MAX_TIMEOUT_SECONDS}, default ${DEFAULT_TIMEOUT_SECONDS})`),
  }),
  execute: async ({ command, timeoutSeconds }) => {
    if (!command || !command.trim()) {
      return { command, exitCode: null, error: "command is required" };
    }

    const safeTimeout =
      typeof timeoutSeconds === "number" && Number.isFinite(timeoutSeconds)
        ? timeoutSeconds
        : DEFAULT_TIMEOUT_SECONDS;
    const timeoutMs = Math.min(Math.max(Math.floor(safeTimeout), 1), MAX_TIMEOUT_SECONDS) * 1000;
    return runCommand(command, process.cwd(), timeoutMs);
  },
  needsApproval: "always",
});
