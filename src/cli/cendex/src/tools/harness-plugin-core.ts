import { join } from "node:path";
import {
	scanRepository,
	readFileContent,
	writeFileContent,
	editFileContent,
	searchRepository,
} from "./fileHandler";
import { cencori, type ChatMessage } from "../server/Models";

const buildSystemPrompt = (
	localDir: string,
) => `You are Maximo Atlas, working locally inside: ${localDir}. 
      
CRITICAL INSTRUCTIONS:
- All repository file contents and directory structures are already provided directly in the user prompt below.
- DO NOT use any tool invocation tags, tool calls, or DSML tags (such as < | DSML | > or <invoke>). 
- Analyze the provided repository text directly and answer the user's task.`;

export const runLocalMemoryAgentWithRepoContext = async (
	taskDescription: string,
	modelId: string,
) => {
	const localDir = process.cwd();
	const basecodeMD = await searchRepository(localDir, "basecode.md", {
		matchType: "exact",
	});

	let repoContextString: string;

	if (!basecodeMD.length) {
		const repoFiles = await scanRepository(localDir);
		repoContextString = repoFiles
			.map((f) => `### File: ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
			.join("\n\n");
	} else {
		repoContextString = await readFileContent(
			join(localDir, basecodeMD[0]!.path),
		);
	}

	const messages: ChatMessage[] = [
		{ role: "system", content: buildSystemPrompt(localDir) },
		{
			role: "user",
			content: `### Repository Context:\n${repoContextString}\n\n### Task:\n${taskDescription}`,
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
