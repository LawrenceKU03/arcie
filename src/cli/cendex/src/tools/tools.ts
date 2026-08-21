type ToolName = "peek"; // add more as you register them, e.g. "peak" | "grep" | "diff"

export type ToolCallCheck = {
	tool: ToolName | null;
	targetFiles: string[];
	actionType: "read" | "write" | "append";
};
