import { join } from "node:path";
import {
	scanRepository,
	readFileContent,
	writeFileContent,
	editFileContent,
	searchRepository,
	scanRepositoryNames,
} from "./fileHandler";
import { cencori, type ChatMessage } from "../server/Models";
import { peakFile, type ToolCallCheck } from "./tools";
import { Readable } from "node:stream";

const extractJson = (raw: string): string => {
	return raw
		.trim()
		.replace(/^```(?:json)?\s*/i, "")
		.replace(/```\s*$/i, "")
		.trim();
};

const buildSystemPrompt = (
	localDir: string,
) => `You are working locally inside: ${localDir}. 
      
CRITICAL INSTRUCTIONS:
- All repository file contents and directory structures are already provided directly in the user prompt below.
- DO NOT use any tool invocation tags, tool calls, or DSML tags (such as < | DSML | > or <invoke>). 
- Analyze the provided repository text directly and answer the user's task.`;

export const runLocalMemoryAgentWithRepoContext = async (
	taskDescription: string,
	modelId: string,
) => {
	const localDir = process.cwd();
	const basecodeMD = await searchRepository(
		localDir,
		Bun.env.BASECODE_README_ID as string,
		{
			matchType: "exact",
		},
	);
	const repoMap_ = await searchRepository(
		localDir,
		Bun.env.REPO_MAP_ID as string,
		{
			matchType: "exact",
		},
	);

	let repoContextString: string;
	let repoMap: string;

	if (!basecodeMD.length || !repoMap_) {
		//const repoFiles = await scanRepository(localDir);
		repoMap = JSON.stringify(await scanRepositoryNames(localDir));
		repoContextString = `### REPO FILE PATHS ${repoMap} ${!basecodeMD.length && "Ask the user to use the /init command to get started"}`;
		writeFileContent(Bun.env.REPO_MAP_ID as string, repoMap);
	} else {
		repoContextString = await readFileContent(
			join(localDir, basecodeMD[0]!.path),
		);
		repoMap = await readFileContent(
			join(localDir, Bun.env.REPO_MAP_ID as string),
		);
	}
	const res = await cencori.ai.chat({
		model: modelId,
		messages: [
			{
				role: "system",
				content: `Convert the user's request into a structured tool-call decision.

If the request requires interacting with a file, respond with ONLY this JSON object (no markdown fences, no extra text):

{
  "tool": "peek",
  "targetFiles": string[],
  "actionType": "read" | "write" | "append"
}

Rules:
- targetFiles must be exact paths as they appear in the repo map (e.g. "src/utils/parser.ts") — no partial names, no descriptions, no guessed paths.
- actionType reflects what the user wants done to those files.
- tool is always "peek" when a tool call applies.

If the request does NOT require a tool call, respond with exactly:
0

No quotes, no JSON wrapper, no explanation — just the bare digit. here is repo map of where the user is working in ${repoMap}`,
			},
			{ role: "user", content: taskDescription },
		],
		temperature: 0.2,
		maxTokens: 1000,
	});

	let fileRead = "";

	try {
		const toolCallCheck = JSON.parse(extractJson(res.content)) as ToolCallCheck;

		for (const filePath of toolCallCheck?.targetFiles ?? []) {
			const fileData = await readFileContent(filePath);
			fileRead += `Content for File Path ${filePath}`;
			fileRead += fileData;
			fileRead += "\n";
		}
	} catch (e) {}

	const messages: ChatMessage[] = [
		{
			role: "system",
			content: buildSystemPrompt(localDir),
		},
		{
			role: "user",
			content:
				`:\n### TASK ${taskDescription} ### repoMap:\n ${repoMap}` +
				`## Repository Context:\n${repoContextString}\n\n` +
				`### File Read Tool Result:${fileRead} + ${JSON.stringify(fileRead)}`,
		},
	];

	const stream = cencori.ai.chatStream({
		model: modelId,
		messages,
		temperature: 0.2,
		maxTokens: 10_000,
	});
	return stream;
};

export const updatePathData = async () => {
	const localDir = process.cwd();
	const repoMap = await scanRepositoryNames(localDir);
	writeFileContent(Bun.env.REPO_MAP_ID as string, JSON.stringify(repoMap));
};
