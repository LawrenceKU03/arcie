import type { DialogContextValue } from "../../providers/DialogProvider";
import type { ToastContextValue } from "../../providers/ToastProvider";
import type { Command } from "./types";
import ScrollablePicker from "../ScrollablePicker";

type CommandContext = {
	toast?: ToastContextValue;
	dialog?: DialogContextValue;
	clearInputBar?: () => void;
};

const MODELS: Command[] = [
	{
		value: "claude-sonnet-5",
		title: "Claude Sonnet 5",
		description: "Balanced default — fast, strong at coding",
		action: () => {},
	},
	{
		value: "claude-opus-4-8",
		title: "Claude Opus 4.8",
		description: "Highest capability, slower and pricier",
		action: () => {},
	},
	{
		value: "openai",
		title: "Chatgpt",
		description: "Cheapest, lowest latency",
		action: () => {},
	},
	// Add Cencori's other routed models here (OpenAI, local/open-source, etc.)
];

const Commands: Command[] = [
	// Session
	{
		title: "New",
		value: "/new",
		description: "Create new session",
		category: "session",
		action: (ctx: CommandContext) => {
			ctx?.toast?.show("New Session!");
			ctx?.clearInputBar();
		},
	},
	{
		title: "Resume",
		value: "/resume",
		description: "Resume a previous session",
		category: "session",
		action: () => {},
	},
	{
		title: "Clear",
		value: "/clear",
		description: "Clear current conversation context",
		category: "session",
		action: () => {},
	},
	{
		title: "Compact",
		value: "/compact",
		description: "Summarize and compact context to free up tokens",
		category: "session",
		action: () => {},
	},
	{
		title: "Rewind",
		value: "/rewind",
		description: "Rewind session to a previous checkpoint",
		category: "session",
		action: () => {},
	},
	{
		title: "Export",
		value: "/export",
		description: "Export session transcript to file",
		category: "session",
		action: () => {},
	},

	// Agent / model
	{
		title: "Models",
		value: "/models",
		description: "Switch the active model",
		category: "agent",
		action: (ctx: CommandContext) => {
			ctx?.dialog?.setDialog({
				title: "Select Model",
				children: (
					<ScrollablePicker
						commandArray={[]}
						searchPlaceHolder="Search Model..."
					/>
				),
			});
			ctx?.clearInputBar();
		},
	},
	{
		title: "Agents",
		value: "/agents",
		description: "List and manage sub-agents",
		category: "agent",
		action: () => {},
	},
	{
		title: "Spawn",
		value: "/spawn",
		description: "Spawn a sub-agent for a delegated task",
		category: "agent",
		action: () => {},
	},

	// MCP
	{
		title: "mcp",
		value: "/mcp",
		description: "List connected MCP servers and their status",
		category: "mcp",
		action: () => {},
	},
	{
		title: "mcp add",
		value: "/mcp-add",
		description: "Add and connect a new MCP server",
		category: "mcp",
		aliases: ["/mcp:add"],
		action: () => {},
	},
	{
		title: "mcp remove",
		value: "/mcp-remove",
		description: "Disconnect and remove an MCP server",
		category: "mcp",
		aliases: ["/mcp:remove"],
		action: () => {},
	},
	{
		title: "mcp auth",
		value: "/mcp-auth",
		description: "Re-authenticate an MCP server connection",
		category: "mcp",
		aliases: ["/mcp:auth"],
		action: () => {},
	},
	{
		title: "mcp tools",
		value: "/mcp tools",
		description: "List tools exposed by connected MCP servers",
		category: "mcp",
		aliases: ["/mcp:tools"],
		action: () => {},
	},

	// Context / memory
	{
		title: "Init",
		value: "/init",
		description: "Scan project and generate an agent context file",
		category: "context",
		action: () => {},
	},
	{
		title: "Add-dir",
		value: "/add-dir",
		description: "Add an additional directory to the agent's scope",
		category: "context",
		action: () => {},
	},
	{
		title: "Memory",
		value: "/memory",
		description: "View or edit persistent agent memory",
		category: "context",
		action: () => {},
	},

	// Tools / permissions
	{
		title: "Permissions",
		value: "/permissions",
		description: "Manage tool and file access permissions",
		category: "tools",
		action: () => {},
	},
	{
		title: "Tools",
		value: "/tools",
		description: "List all available tools and their scopes",
		category: "tools",
		action: () => {},
	},
	{
		title: "Sandbox",
		value: "/sandbox",
		description: "Toggle sandboxed execution mode",
		category: "tools",
		action: () => {},
	},

	// Git / VCS
	{
		title: "Diff",
		value: "/diff",
		description: "Show pending changes made by the agent",
		category: "vcs",
		action: () => {},
	},
	{
		title: "Commit",
		value: "/commit",
		description: "Generate and create a commit for staged changes",
		category: "vcs",
		action: () => {},
	},
	{
		title: "Review",
		value: "/review",
		description: "Review agent-generated changes before applying",
		category: "vcs",
		action: () => {},
	},
	{
		title: "PR",
		value: "/pr",
		description: "Open a pull request for the current branch",
		category: "vcs",
		action: () => {},
	},

	// Meta / utility
	{
		title: "Cost",
		value: "/cost",
		description: "Show token usage and cost for this session",
		category: "meta",
		action: () => {},
	},
	{
		title: "Config",
		value: "/config",
		description: "Open harness configuration",
		category: "meta",
		action: () => {},
	},
	{
		title: "Doctor",
		value: "/doctor",
		description: "Run diagnostics on the harness setup",
		category: "meta",
		action: () => {},
	},
	{
		title: "Login",
		value: "/login",
		description: "Authenticate with the model provider",
		category: "meta",
		action: () => {},
	},
	{
		title: "Logout",
		value: "/logout",
		description: "Sign out of the current provider session",
		category: "meta",
		action: () => {},
	},
	{
		title: "Help",
		value: "/help",
		description: "Show available commands",
		category: "meta",
		action: () => {},
	},
	{
		title: "Bug",
		value: "/bug",
		description: "Report a bug to the maintainers",
		category: "meta",
		action: () => {},
	},
];

export const getFilteredCommands = (targetCmd: string) => {
	const filteredCMDS = Commands.filter((cmd) =>
		cmd.value.toLowerCase().startsWith(targetCmd.toLowerCase()),
	);
	return filteredCMDS.length > 0 ? filteredCMDS : Commands;
};

export default Commands;
