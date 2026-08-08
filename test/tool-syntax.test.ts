import { describe, it, expect } from "vitest";
import { createToolSyntaxFilter, stripToolSyntax } from "../src/runner/tool-syntax";

function streamThrough(chunks: string[]): { text: string; leaked: boolean } {
  const filter = createToolSyntaxFilter();
  let text = "";
  for (const chunk of chunks) text += filter.push(chunk);
  text += filter.flush();
  return { text, leaked: filter.leaked };
}

/** Feeds the input one character at a time — the worst case for a streaming filter. */
function streamByChar(input: string): { text: string; leaked: boolean } {
  return streamThrough([...input]);
}

describe("stripToolSyntax", () => {
  it("removes the malformed llama function call seen in production", () => {
    const leaked = `<function(updateWorkingMemory){"content": "The user is aware that the Cencori team built the agent."}</function>`;
    expect(stripToolSyntax(leaked)).toBe("");
  });

  it("removes the canonical llama function call format", () => {
    expect(stripToolSyntax(`<function=search>{"q": "arcie"}</function>`)).toBe("");
  });

  it("removes hermes-style tool_call blocks", () => {
    expect(stripToolSyntax(`<tool_call>{"name": "search"}</tool_call>`)).toBe("");
  });

  it("removes Gemini-style tool code and its leaked result", () => {
    const input = [
      "Let me check the docs.\n",
      `<tool_code>print(search_docs(query="cencori setup"))</tool_code>`,
      `<result>{"answer":"internal tool payload"}</result>`,
      "\nHere is the setup guide.",
    ].join("");

    expect(stripToolSyntax(input)).toBe("Let me check the docs.\n\nHere is the setup guide.");
  });

  it("preserves standalone result tags used as ordinary XML", () => {
    const input = "Return `<result>ok</result>` from the parser.";
    expect(stripToolSyntax(input)).toBe(input);
  });

  it("removes the python_tag block up to its end token", () => {
    const input = `<|python_tag|>search.call(q="x")<|eom_id|>Here is the answer.`;
    expect(stripToolSyntax(input)).toBe("Here is the answer.");
  });

  it("drops everything after an open-ended [TOOL_CALLS] marker", () => {
    expect(stripToolSyntax(`Sure.\n[TOOL_CALLS] [{"name": "search"}]`)).toBe("Sure.\n");
  });

  it("keeps the prose around a leaked call", () => {
    const input = `Let me check.<function=lookup>{"id": 1}</function>The answer is 42.`;
    expect(stripToolSyntax(input)).toBe("Let me check.The answer is 42.");
  });

  it("drops an unterminated call rather than showing a partial tag", () => {
    expect(stripToolSyntax(`Done.<function=lookup>{"id": 1}`)).toBe("Done.");
  });

  it("leaves ordinary prose and markup untouched", () => {
    const text = "Use `Array<string>` and see [TODO] items in <b>bold</b>.\n\n- a < b\n- c > d";
    expect(stripToolSyntax(text)).toBe(text);
  });

  it("leaves an incomplete lookalike prefix in place", () => {
    expect(stripToolSyntax("the <func keyword")).toBe("the <func keyword");
  });
});

describe("createToolSyntaxFilter", () => {
  it("suppresses a call split across deltas", () => {
    const result = streamThrough([
      "Checking",
      " that.<fun",
      "ction(updateWorkingMemory){",
      `"content": "x"}</fun`,
      "ction>",
      "All set.",
    ]);
    expect(result.text).toBe("Checking that.All set.");
    expect(result.leaked).toBe(true);
  });

  it("suppresses a call fed one character at a time", () => {
    const result = streamByChar(`Hi.<function=f>{"a": 1}</function> Bye.`);
    expect(result.text).toBe("Hi. Bye.");
    expect(result.leaked).toBe(true);
  });

  it("suppresses split tool_code and result markers without leaking partial tags", () => {
    const result = streamThrough([
      "Checking.<tool_",
      "code>print(search_docs())</tool_",
      "code>\n<res",
      "ult>{\"answer\":\"hidden\"}</res",
      "ult>\nDone.",
    ]);

    expect(result.text).toBe("Checking.\n\nDone.");
    expect(result.leaked).toBe(true);
  });

  it("emits prose that only looked like the start of a marker", () => {
    const result = streamThrough(["a < b and ", "c > d"]);
    expect(result.text).toBe("a < b and c > d");
    expect(result.leaked).toBe(false);
  });

  it("never emits a partial marker before it is resolved", () => {
    const filter = createToolSyntaxFilter();
    expect(filter.push("ok <tool_")).toBe("ok ");
    expect(filter.push("call>{}</tool_call>")).toBe("");
    expect(filter.flush()).toBe("");
  });

  it("streams prose unchanged when nothing leaks", () => {
    const result = streamThrough(["Hello, ", "world", "!"]);
    expect(result.text).toBe("Hello, world!");
    expect(result.leaked).toBe(false);
  });

  it("handles back-to-back calls", () => {
    const input = `<tool_call>{"a":1}</tool_call><tool_call>{"b":2}</tool_call>done`;
    expect(stripToolSyntax(input)).toBe("done");
  });
});
