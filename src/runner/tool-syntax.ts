/**
 * Strips model-emitted tool-call markup out of assistant text.
 *
 * Open-weight models (Llama, Qwen, Mistral, ...) express tool calls as
 * literal text in the completion — `<function=name>{...}</function>`,
 * `<tool_call>{...}</tool_call>`, `[TOOL_CALLS] [...]`. The provider is
 * supposed to parse those back into structured tool calls, but the parse
 * is format-sensitive: one malformed variant (`<function(name){...}`) and
 * the markup falls through the parser and streams to the user as prose.
 *
 * Arcie is the last layer that can tell the difference, so it drops the
 * markup rather than rendering it. The call itself is lost either way —
 * there is no action_id to resume from — but the user sees nothing
 * instead of seeing the model's plumbing.
 */

type Marker = {
  /** Literal opening tokens, matched case-insensitively. */
  open: string[];
  /** Literal closing token; when absent, everything after the open is dropped. */
  close?: string;
};

const MARKERS: Marker[] = [
  // Hermes / Qwen / NousResearch.
  { open: ["<tool_call>"], close: "</tool_call>" },
  // XML-ish call blocks some models copy out of prompt examples.
  { open: ["<function_calls>"], close: "</function_calls>" },
  { open: ["<invoke ", "<invoke>"], close: "</invoke>" },
  // Llama's `<function=name>`, plus the malformed `<function(name)` variant
  // that slips past provider-side parsers.
  { open: ["<function=", "<function(", "<function ", "<function>"], close: "</function>" },
  // Llama 3.1 built-in tools.
  { open: ["<|python_tag|>"], close: "<|eom_id|>" },
  // Mistral. No closing token — the rest of the message is the call.
  { open: ["[TOOL_CALLS]"] },
];

const OPEN_TOKENS: Array<{ token: string; marker: Marker }> = MARKERS.flatMap((marker) =>
  marker.open.map((token) => ({ token: token.toLowerCase(), marker })),
);

/** Longest opening token — bounds how much trailing text we hold back. */
const MAX_OPEN_LEN = Math.max(...OPEN_TOKENS.map((t) => t.token.length));

function matchOpen(lower: string, index: number): Marker | undefined {
  return OPEN_TOKENS.find((t) => lower.startsWith(t.token, index))?.marker;
}

/**
 * True when `lower.slice(index)` is a strict prefix of some opening token —
 * a delta that ends mid-token (`"...<func"`) must be withheld until the next
 * delta arrives, or a split marker leaks one character at a time.
 */
function couldStartMarker(lower: string, index: number): boolean {
  const tail = lower.slice(index);
  if (tail.length >= MAX_OPEN_LEN) return false;
  return OPEN_TOKENS.some((t) => t.token.startsWith(tail));
}

export interface ToolSyntaxFilter {
  /** Feeds a streamed delta in, returns the text that is safe to show. */
  push(delta: string): string;
  /** Ends the stream, returning any withheld text that turned out to be prose. */
  flush(): string;
  /** True once any tool markup has been suppressed. */
  readonly leaked: boolean;
}

export function createToolSyntaxFilter(): ToolSyntaxFilter {
  let buffer = "";
  let suppressing: Marker | undefined;
  let leaked = false;

  function drain(final: boolean): string {
    let out = "";

    for (;;) {
      const lower = buffer.toLowerCase();

      if (suppressing) {
        const close = suppressing.close;
        if (!close) {
          // Open-ended marker: everything to the end of the turn is markup.
          buffer = "";
          return out;
        }
        const end = lower.indexOf(close.toLowerCase());
        if (end === -1) {
          // Retain only enough tail to recognise a close token split across deltas.
          buffer = final ? "" : buffer.slice(Math.max(0, buffer.length - close.length + 1));
          return out;
        }
        buffer = buffer.slice(end + close.length);
        suppressing = undefined;
        continue;
      }

      let index = 0;
      let found: Marker | undefined;
      while (index < buffer.length) {
        const char = buffer[index]!;
        if (char === "<" || char === "[") {
          found = matchOpen(lower, index);
          if (found) break;
          if (!final && couldStartMarker(lower, index)) break;
        }
        index += 1;
      }

      out += buffer.slice(0, index);
      buffer = buffer.slice(index);

      if (!found) return out;

      leaked = true;
      suppressing = found;
    }
  }

  return {
    push(delta: string): string {
      if (delta.length === 0) return "";
      buffer += delta;
      return drain(false);
    },
    flush(): string {
      const out = drain(true);
      buffer = "";
      suppressing = undefined;
      return out;
    },
    get leaked(): boolean {
      return leaked;
    },
  };
}

/** One-shot form for text that arrives whole rather than as deltas. */
export function stripToolSyntax(text: string): string {
  const filter = createToolSyntaxFilter();
  return filter.push(text) + filter.flush();
}
