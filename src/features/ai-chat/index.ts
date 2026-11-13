/**
 * The AI chat assistant (ADR-128), behind `FLAG_AI_SEARCH`. So far it is the tools and the agent loop:
 * nothing here is wired to a page or a route, and customers see nothing. Server-only: every export reads through the
 * cached public reads.
 */
export { ANSWER_ONLY_INSTRUCTION } from "./agent-instructions";
export { AGENT_MESSAGE_KEYS } from "./agent-types";
export type {
  AgentDone,
  AgentEvent,
  AgentFallbackReason,
  AgentInput,
  AgentLimit,
  AgentOutcome,
  AgentUsage,
} from "./agent-types";
export { runAgent } from "./agent";
export { AI_CHAT_TOOLS } from "./tools/registry";
export { runTool, toolDefinitions, toolError } from "./tools/run";
export { TOOL_ERROR_CODES, TOOL_ERROR_HINTS } from "./tools/types";
export type {
  AiChatTool,
  AnyAiChatTool,
  ToolContext,
  ToolErrorCode,
  ToolKind,
  ToolOutcome,
  ToolReference,
  ToolRun,
} from "./tools/types";
export { UNTRUSTED_TEXT_KEY } from "./tools/untrusted";
