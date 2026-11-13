/**
 * The AI chat assistant (ADR-128), behind `FLAG_AI_SEARCH`. So far it is the tools only: nothing here is
 * wired to a page or a route, and customers see nothing. Server-only: every export reads through the
 * cached public reads.
 */
export { AI_CHAT_TOOLS } from "./tools/registry";
export { runTool, toolDefinitions, toolError } from "./tools/run";
export { TOOL_ERROR_CODES } from "./tools/types";
export type {
  AiChatTool,
  AnyAiChatTool,
  ToolContext,
  ToolErrorCode,
  ToolOutcome,
  ToolReference,
  ToolRun,
} from "./tools/types";
export { UNTRUSTED_TEXT_KEY } from "./tools/untrusted";
