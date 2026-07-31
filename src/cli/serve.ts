import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { startContractServer } from "../server/contract";
import { grey, dimmed } from "./style";

export interface ServeOptions {
  agentDir: string;
  port?: number;
  host?: string;
  memory?: boolean;
}

/**
 * Boots the Runtime Contract server for a built agent. This is the process a
 * deployed Arcie container runs: `arcie serve` on `$PORT`, answering
 * `/_health`, `/invoke`, `/channels/:name`, `/schedules/:name`, `/_manifest`.
 */
export async function serveCommand(options: ServeOptions): Promise<void> {
  const agentDir = resolve(process.cwd(), options.agentDir);

  if (!existsSync(agentDir)) {
    console.error(`  ${grey("✖")} agent directory not found: ${agentDir}`);
    process.exit(1);
  }

  if (!process.env.CENCORI_API_KEY) {
    console.warn(`  ${grey("⚠")} CENCORI_API_KEY is not set — /invoke will fail until it is`);
  }

  const { port } = await startContractServer({
    agentDir,
    port: options.port,
    host: options.host,
    hotReload: false,
    memory: options.memory,
  });

  const host = options.host ?? "0.0.0.0";
  console.log();
  console.log(`  ${dimmed(`arcie runtime  http://${host}:${port}`)}`);
  console.log(`  ${dimmed(`agent          ${agentDir}`)}`);
  console.log();
  console.log(`  ${dimmed("routes")}`);
  console.log(`  ${grey("\xB7")} GET  /_health`);
  console.log(`  ${grey("\xB7")} GET  /_manifest`);
  console.log(`  ${grey("\xB7")} POST /invoke`);
  console.log(`  ${grey("\xB7")} POST /channels/:name`);
  console.log(`  ${grey("\xB7")} POST /schedules/:name`);
  console.log();

  const shutdown = () => process.exit(0);
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
