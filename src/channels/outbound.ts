export interface SlackReplyOptions {
  /** Bot token. Defaults to `SLACK_BOT_TOKEN`. */
  token?: string;
  /** Reply inside a thread (the parent message's ts). */
  threadTs?: string;
}

export interface ReplyResult {
  ok: boolean;
  error?: string;
}

const SLACK_API = "https://slack.com/api";

/**
 * Posts a message to a Slack channel with the bot token (`SLACK_BOT_TOKEN`
 * by default). Use this from a channel handler to deliver the agent's reply
 * asynchronously — the Events API acknowledgment and the actual reply are
 * separate, so agents can take as long as they need.
 */
export async function replyToSlack(
  channel: string,
  text: string,
  options: SlackReplyOptions = {},
): Promise<ReplyResult> {
  const token = options.token ?? process.env.SLACK_BOT_TOKEN;
  if (!token) {
    return { ok: false, error: "SLACK_BOT_TOKEN not set — cannot post the reply" };
  }
  if (!text || text.trim().length === 0) {
    return { ok: false, error: "refusing to post an empty reply" };
  }

  try {
    const res = await fetch(`${SLACK_API}/chat.postMessage`, {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel,
        text: text.slice(0, 40_000),
        ...(options.threadTs ? { thread_ts: options.threadTs } : {}),
      }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (res.ok && data.ok) return { ok: true };
    return { ok: false, error: data.error ?? `Slack API error (${res.status})` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

const DISCORD_API = "https://discord.com/api/v10";

/**
 * Sends a channel message reply to a Discord interaction using its
 * interaction token (`/interactions/{id}/{token}/callback`). Works both as
 * the initial response and as a followup after `type: 5` deferral.
 */
export async function replyToDiscord(
  interactionId: string,
  interactionToken: string,
  content: string,
): Promise<ReplyResult> {
  if (!content || content.trim().length === 0) {
    return { ok: false, error: "refusing to post an empty reply" };
  }

  try {
    const res = await fetch(
      `${DISCORD_API}/interactions/${interactionId}/${interactionToken}/callback`,
      {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: 4,
          data: { content: content.slice(0, 2000) },
        }),
      },
    );
    if (res.ok) return { ok: true };
    return { ok: false, error: `Discord API error (${res.status})` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
