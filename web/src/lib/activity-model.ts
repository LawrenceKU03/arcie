import {
  AiBrain01Icon,
  AlertCircleIcon,
  BookOpen02Icon,
  Calculator01Icon,
  Database01Icon,
  File01Icon,
  Globe02Icon,
  Link01Icon,
  Search01Icon,
  TerminalIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import type { AssistantArtifact, AssistantSource } from "./assistant-output.ts";
import type { UiToolCall } from "./types.ts";

export type ActivityIcon = typeof AiBrain01Icon;

export interface ActivityStep {
  id: string;
  label: string;
  detail?: string;
  icon: ActivityIcon;
  status?: UiToolCall["status"] | "info";
  toolCall?: UiToolCall;
}

export interface ActivityResource {
  id: string;
  label: string;
  detail?: string;
  href?: string;
}

export interface ActivityModel {
  activeLabel: "Thinking" | "Working";
  completedLabel: string;
  durationLabel?: string;
  fileItems: ActivityResource[];
  hasObservableWork: boolean;
  memoryItems: ActivityResource[];
  sourceItems: ActivityResource[];
  steps: ActivityStep[];
  uniqueArtifacts: AssistantArtifact[];
}

export function normalizeActivityText(value: string, max = 220): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1).trimEnd()}…`;
}

function recordOf(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function readableValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    return normalizeActivityText(value, 180);
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

export function toolDetail(call: UiToolCall): string | undefined {
  if (call.errorMessage) return normalizeActivityText(call.errorMessage, 180);

  const input = recordOf(call.input);
  if (input) {
    for (const key of ["query", "prompt", "expression", "url", "path", "file", "name", "input"]) {
      const detail = readableValue(input[key]);
      if (detail) return detail;
    }
  }

  const directInput = readableValue(call.input);
  if (directInput) return directInput;

  const output = recordOf(call.output);
  if (output) {
    if (typeof output.count === "number") {
      return output.count === 0
        ? "No matches found"
        : `${output.count} result${output.count === 1 ? "" : "s"} found`;
    }
    for (const key of ["summary", "message", "result", "value", "text"]) {
      const detail = readableValue(output[key]);
      if (detail) return detail;
    }
  }

  return undefined;
}

function fileResourcePath(call: UiToolCall): string | undefined {
  const records = [recordOf(call.input), recordOf(call.output)];

  for (const record of records) {
    if (!record) continue;
    for (const key of ["path", "file", "filename", "name"]) {
      const path = readableValue(record[key]);
      if (path && path !== "." && path !== "./") return path;
    }
  }

  return undefined;
}

function fileResourceName(path: string): string {
  const segments = path.split(/[\\/]/).filter(Boolean);
  return segments.at(-1) ?? path;
}

function sentenceCaseToolName(name: string): string {
  const readable = name.replaceAll(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (readable.length === 0) return "task";
  return `${readable[0]!.toUpperCase()}${readable.slice(1)}`;
}

export function toolPresentation(
  call: UiToolCall,
): Omit<ActivityStep, "id" | "detail" | "status" | "toolCall"> {
  const active = call.status === "running" || call.status === "approval";
  const name = call.name.toLowerCase();

  if (call.kind === "subagent") {
    return {
      label: active ? "Working with another agent" : "Worked with another agent",
      icon: UserGroupIcon,
    };
  }
  if (/create.*document|document_(?:create|write)|write_(?:document|file)|generate_(?:docx|pdf)/.test(name)) {
    return { label: active ? "Creating the document" : "Created the document", icon: File01Icon };
  }
  if (/web_search|search_web|browser_search/.test(name)) {
    return { label: active ? "Searching the web" : "Searched the web", icon: Globe02Icon };
  }
  if (/search_docs|document_query/.test(name)) {
    return { label: active ? "Searching documents" : "Searched documents", icon: BookOpen02Icon };
  }
  if (/fetch_url|read_url|open_url/.test(name)) {
    return { label: active ? "Reading a source" : "Read a source", icon: Link01Icon };
  }
  if (/document_|file_reader|read_file/.test(name)) {
    return { label: active ? "Reading documents" : "Read documents", icon: File01Icon };
  }
  if (/calculator|calculate/.test(name)) {
    return { label: active ? "Calculating" : "Calculated the result", icon: Calculator01Icon };
  }
  if (/grep|search_files/.test(name)) {
    return { label: active ? "Searching files" : "Searched files", icon: Search01Icon };
  }
  if (/memory_query|past_chat|conversation_search/.test(name)) {
    return { label: active ? "Searching memory" : "Checked memory", icon: Database01Icon };
  }
  if (/vision_/.test(name)) {
    return { label: active ? "Analyzing an image" : "Analyzed an image", icon: AiBrain01Icon };
  }
  if (/current_time/.test(name)) {
    return { label: active ? "Checking the time" : "Checked the time", icon: AiBrain01Icon };
  }
  if (/shell|terminal|exec|command|python|code/.test(name)) {
    return { label: active ? "Running a task" : "Ran a task", icon: TerminalIcon };
  }

  const readableName = sentenceCaseToolName(call.name);
  return {
    label: active ? `Using ${readableName}` : `Used ${readableName}`,
    icon: AiBrain01Icon,
  };
}

function artifactPresentation(artifact: AssistantArtifact, index: number): ActivityStep {
  const icon = {
    query: Search01Icon,
    results: Globe02Icon,
    source: Link01Icon,
    document: BookOpen02Icon,
  }[artifact.kind];

  return {
    id: `artifact-${artifact.kind}-${index}`,
    label: artifact.label,
    detail: artifact.detail ? normalizeActivityText(artifact.detail, 180) : undefined,
    icon,
    status: "info",
  };
}

export function formatActivityDuration(latencyMs?: number): string | undefined {
  if (latencyMs === undefined) return undefined;

  const totalSeconds = Math.max(1, Math.round(latencyMs / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}

export function formatToolDuration(call: UiToolCall): string | undefined {
  if (call.startedAt === undefined) return undefined;
  const end = call.completedAt ?? Date.now();
  return formatActivityDuration(Math.max(0, end - call.startedAt));
}

function uniqueSources(artifacts: AssistantArtifact[]): AssistantSource[] {
  const seen = new Set<string>();
  return artifacts.flatMap((artifact) => artifact.sources ?? []).filter((source) => {
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}

function uniqueArtifacts(artifacts: AssistantArtifact[]): AssistantArtifact[] {
  const seen = new Set<string>();
  return artifacts.filter((artifact) => {
    const key = [
      artifact.kind,
      artifact.detail?.toLowerCase() ?? "",
      artifact.resultCount ?? "",
    ].join(":");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildActivityModel({
  artifacts,
  hasVisibleContent,
  latencyMs,
  streaming,
  toolCalls,
}: {
  artifacts: AssistantArtifact[];
  hasVisibleContent: boolean;
  latencyMs?: number;
  streaming: boolean;
  toolCalls: UiToolCall[];
}): ActivityModel {
  const artifactsForDisplay = uniqueArtifacts(artifacts);
  const steps: ActivityStep[] = toolCalls.map((call) => {
    const presentation = toolPresentation(call);
    return {
      id: call.callId,
      ...presentation,
      detail: toolDetail(call),
      status: call.status,
      toolCall: call,
    };
  });

  artifactsForDisplay.forEach((artifact, index) => {
    steps.push(artifactPresentation(artifact, index));
  });

  const hasRunningStep = steps.some(
    (step) => step.status === "running" || step.status === "approval",
  );
  if (streaming && !hasRunningStep) {
    steps.push({
      id: "active",
      label: hasVisibleContent ? "Writing the response" : "Thinking",
      icon: AiBrain01Icon,
      status: "running",
    });
  }

  const memoryItems = toolCalls
    .filter((call) => /memory_query|past_chat|conversation_search/.test(call.name))
    .map((call) => ({
      id: `memory-${call.callId}`,
      label: toolPresentation(call).label,
      detail: toolDetail(call),
    }));

  const seenFiles = new Set<string>();
  const fileItems = toolCalls
    .filter((call) => /document_|file_reader|read_file|write_file|vision_/.test(call.name))
    .flatMap((call) => {
      const path = fileResourcePath(call);
      if (!path) return [];

      const key = path.toLowerCase();
      if (seenFiles.has(key)) return [];
      seenFiles.add(key);

      const label = fileResourceName(path);
      return [{
        id: `file-${call.callId}`,
        label,
        detail: label === path ? undefined : path,
      }];
    });

  const sourceItems = uniqueSources(artifactsForDisplay).map((source, index) => ({
    id: `source-${index}-${source.url}`,
    label: source.title,
    detail: source.url,
    href: source.url,
  }));

  const hasObservableWork = toolCalls.length > 0 || artifactsForDisplay.length > 0;
  const durationLabel = formatActivityDuration(latencyMs);
  const completedLabel = durationLabel
    ? `${hasObservableWork ? "Worked" : "Thought"} for ${durationLabel}`
    : hasObservableWork
      ? "Work completed"
      : "Thought";

  return {
    activeLabel: hasObservableWork ? "Working" : "Thinking",
    completedLabel,
    durationLabel,
    fileItems,
    hasObservableWork,
    memoryItems,
    sourceItems,
    steps,
    uniqueArtifacts: artifactsForDisplay,
  };
}

export function formatActivityPayload(value: unknown, max = 8000): string | undefined {
  if (value === undefined) return undefined;

  let formatted: string;
  if (typeof value === "string") {
    formatted = value;
  } else {
    try {
      formatted = JSON.stringify(value, null, 2);
    } catch {
      formatted = String(value);
    }
  }

  if (formatted.length <= max) return formatted;
  return `${formatted.slice(0, max).trimEnd()}\n…`;
}

export function activityStatusLabel(status: ActivityStep["status"]): string {
  return {
    approval: "Needs approval",
    denied: "Denied",
    done: "Completed",
    error: "Failed",
    info: "Recorded",
    running: "In progress",
  }[status ?? "info"];
}

export { AlertCircleIcon };
