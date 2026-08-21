import { join } from "node:path";
import {
	readFileContent,
	writeFileContent,
	searchRepository,
	scanRepositoryNames,
} from "./fileHandler";
import { cencori, type ChatMessage } from "../server/Models";
import type { ToolCallCheck } from "./tools";

const extractJson = (raw: string): string =>
	raw
		.trim()
		.replace(/^```(?:json)?\s*/i, "")
		.replace(/```\s*$/i, "")
		.trim();

/**
 * System prompt for the *decision* call.
 */
const buildToolDecisionPrompt = (
	repoMap: string,
) => `You decide whether answering the user's task requires reading a specific file's ACTUAL CURRENT CONTENT, or whether it can be handled without one.

REPO MAP (file paths only — names, not contents):
${repoMap}

THE TEST:
Ask yourself: "Can this be answered correctly using only the file/folder names above, general programming knowledge, and conversation context — or does the answer depend on what's actually written inside a specific file?"

- If correctness depends on real content -> you need to read it.
- If the file names alone are enough -> you don't.

WHEN TO READ (tool: "peek"):
- The user asks about a specific file's behavior, exports, bugs, or implementation
- The user wants a file edited, extended, or refactored
- The task requires knowing how two or more files interact

WHEN NOT TO READ (respond "0"):
- The question is about project structure or naming (repo map already answers this)
- General conceptual knowledge
- You already have the relevant file's content earlier in the conversation

OUTPUT FORMAT — respond with ONE of the following, nothing else:

1. If reading is required, respond with ONLY this JSON object:
{
  "tool": "peek",
  "targetFiles": string[],
  "actionType": "read" | "write" | "append"
}

2. If reading is not required, respond with exactly:
0

RULES:
- "targetFiles" must be exact paths copied from the repo map above.
- Never output both the JSON and "0" — pick exactly one.`;

/**
 * System prompt for the main agent turn.
 */
const buildAgentSystemPrompt = (
	localDir: string,
) => `You are working locally inside: ${localDir}.

TOOL ACCESS: You have NONE in this turn. Every file and piece of repository context you need has already been fetched and is provided in the user message below. This is a single-shot response.

Because of this, you must NEVER emit XML/JSON tool-call syntax of any kind. 
It will render as raw broken text directly in the user's terminal.

If something you need is NOT present:
- Do not guess or hallucinate.
- Say so plainly in ordinary prose.

If the requested action is a write/edit:
- Reproduce the FULL new file content exactly as it should exist after the change.`;

/**
 * Notice this is now an async generator function (async function*)
 * so it can yield UI updates directly to your chat loop!
 */
export async function* runLocalMemoryAgentWithRepoContext(
	taskDescription: string,
	modelId: string,
	priorMessages: ChatMessage[] = [],
	updateThinkingWord?: () => void,
) {
	const localDir = process.cwd();

	// We can yield an initial thinking state to the UI
	yield { delta: "Thinking through repository...\n\n" };

	const basecodeMatches = await searchRepository(
		localDir,
		Bun.env.BASECODE_README_ID as string,
		{ matchType: "exact" },
	);
	const repoMapMatches = await searchRepository(
		localDir,
		Bun.env.REPO_MAP_ID as string,
		{ matchType: "exact" },
	);

	let repoContextString: string;
	let repoMap: string;

	if (!basecodeMatches.length || !repoMapMatches.length) {
		repoMap = JSON.stringify(await scanRepositoryNames(localDir));
		repoContextString = `### REPO FILE PATHS\n${repoMap}${!basecodeMatches.length
				? "\n\nAsk the user to run /init to get started."
				: ""
			}`;
		await writeFileContent(Bun.env.REPO_MAP_ID as string, repoMap);
	} else {
		repoContextString = await readFileContent(
			join(localDir, basecodeMatches[0]!.path),
		);
		repoMap = await readFileContent(
			join(localDir, Bun.env.REPO_MAP_ID as string),
		);
	}

	// Step 1: Decide whether a file needs to be read
	const decisionRes = await cencori.ai.chat({
		model: modelId,
		messages: [
			{ role: "system", content: buildToolDecisionPrompt(repoMap) },
			{ role: "user", content: taskDescription },
		],
		temperature: 0.2,
		maxTokens: 1000,
	});

	let toolCallCheck: ToolCallCheck | null = null;
	let fileReadResult = "";

	try {
		const rawDecision = extractJson(decisionRes.content);
		if (rawDecision !== "0") {
			const parsed = JSON.parse(rawDecision);
			if (parsed && typeof parsed === "object") {
				toolCallCheck = parsed as ToolCallCheck;

				// Yield visual feedback to the user that a tool is being used!
				if (
					toolCallCheck.tool === "peek" &&
					toolCallCheck.targetFiles?.length
				) {
					yield {
						delta: `+ Reading ${toolCallCheck.targetFiles.length} ${toolCallCheck.targetFiles.length > 1 ? "files" : "file"}...\n\n`,
					};
				}

				for (const filePath of toolCallCheck.targetFiles ?? []) {
					try {
						const fileData = await readFileContent(join(localDir, filePath));
						fileReadResult += `--- ${filePath} ---\n${fileData}\n`;
					} catch (e: any) {
						fileReadResult += `--- ${filePath} ---\nFailed to read: ${e.message}\n`;
					}

					yield {
						delta: `- Read ${filePath}\n\n`,
					};

					if (updateThinkingWord) {
						setTimeout(() => {
							updateThinkingWord();
						}, 100);
					}
				}
			}
		}
	} catch (err) {
		console.error(
			"[runLocalMemoryAgentWithRepoContext] tool-decision parse failed:",
			err,
		);
	}

	// Step 2: Build final agent context
	const includeFullContext = priorMessages.length < 5;

	const taskMessage: ChatMessage = {
		role: "user",
		content: [
			`### TASK\n${taskDescription}`,
			`### REPO MAP\n${repoMap}`,
			includeFullContext ? `### REPOSITORY CONTEXT\n${repoContextString}` : "",
			toolCallCheck
				? `### FILE READ RESULT (COMMAND: ${toolCallCheck.tool}, action: ${toolCallCheck.actionType})\n${fileReadResult}`
				: "",
		]
			.filter(Boolean)
			.join("\n\n"),
	};

	const messages: ChatMessage[] = [
		{ role: "system", content: buildAgentSystemPrompt(localDir) },
		...priorMessages,
		taskMessage,
	];

	// Step 3: Stream the final response and yield it out chunk by chunk
	const finalStream = await cencori.ai.chatStream({
		model: modelId,
		messages,
		temperature: 0.2,
		maxTokens: 10_000,
	});

	for await (const chunk of finalStream) {
		yield chunk;
		if (updateThinkingWord) updateThinkingWord();
	}
}

export const updatePathData = async () => {
	const localDir = process.cwd();
	const repoMap = await scanRepositoryNames(localDir);
	await writeFileContent(
		Bun.env.REPO_MAP_ID as string,
		JSON.stringify(repoMap),
	);
};

