import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface ScaffoldSlackResult {
  readonly targetPath: string;
  readonly alreadyExisted: boolean;
}

const SLACK_CHANNEL_TEMPLATE = `import { defineChannel, POST, runAgent, verifySlackRequest, replyToSlack } from "arcie";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/*
  Slack Events API channel — signed, replying, production-ready.

  1. Create a Slack app at https://api.slack.com/apps
  2. Enable Event Subscriptions and subscribe to app_mention.
     Point the Request URL to:
     https://your-domain.com/api/channels/slack/events
  3. Add the env vars (see .env.local):
     SLACK_SIGNING_SECRET   — every request is HMAC-verified (401 otherwise)
     SLACK_BOT_TOKEN        — used to post the agent's replies
  4. For local dev, expose the server with a tunnel (ngrok).

  The Events API acknowledgment and the reply are independent: this handler
  verifies the signature, acknowledges with 200, then posts the agent's
  reply asynchronously with the bot token.
*/

const agentDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export default defineChannel({
  name: "slack",
  type: "slack",
  handler: POST(async (request) => {
    const verification = verifySlackRequest(request);
    if (!verification.ok) {
      return { status: 401, body: { error: verification.error } };
    }
    if (verification.skipped) {
      console.warn("[slack] " + verification.skipped);
    }

    const payload = request.body as Record<string, unknown>;

    // Slack URL verification challenge
    if (payload.type === "url_verification") {
      return { status: 200, body: { challenge: payload.challenge } };
    }

    // Event callback
    if (payload.type === "event_callback") {
      const event = payload.event as Record<string, unknown> | undefined;
      const text = event?.text as string | undefined;
      const channel = event?.channel as string | undefined;
      const threadTs = event?.thread_ts as string | undefined;
      const isBot = event?.bot_id !== undefined;

      if (event?.type === "app_mention" || (event?.type === "message" && !isBot)) {
        if (text && channel) {
          try {
            const { output } = await runAgent(agentDir, text, {
              resourceId: \`slack:\${channel}\`,
              sessionId: threadTs ?? channel,
            });
            const reply = await replyToSlack(channel, output, threadTs ? { threadTs } : undefined);
            if (!reply.ok) console.error("[slack] reply failed:", reply.error);
          } catch (err) {
            console.error("[slack] agent run failed:", err instanceof Error ? err.message : err);
          }
        }
      }
    }

    return { status: 200, body: { ok: true } };
  }),
});
`;

export function scaffoldSlackChannel(agentDir: string): ScaffoldSlackResult {
  const targetDir = join(agentDir, "channels");
  const targetFile = join(targetDir, "slack.ts");

  if (existsSync(targetFile)) {
    return { targetPath: targetFile, alreadyExisted: true };
  }

  mkdirSync(targetDir, { recursive: true });
  writeFileSync(targetFile, SLACK_CHANNEL_TEMPLATE, "utf-8");
  return { targetPath: targetFile, alreadyExisted: false };
}
