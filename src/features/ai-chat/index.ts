/**
 * The AI chat assistant (ADR-128), behind `FLAG_AI_SEARCH`: the tools, the agent loop, the two guards, the system
 * prompt and the streaming endpoint (`handleAiChat`, called by `src/app/api/ai/chat/route.ts`). No page uses it yet.
 * Server-only: every export reads through the cached public reads.
 */
export { ANSWER_ONLY_INSTRUCTION } from "./prompts/answer-only";
export { buildSystemPrompt } from "./prompts/system-prompt";
export type { SystemPromptOptions } from "./prompts/system-prompt";
export { SYSTEM_PROMPT_CANARY, SYSTEM_PROMPT_VERSION } from "./prompts/version";
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
export { referenceKey, TOOL_ERROR_CODES, TOOL_ERROR_HINTS } from "./tools/types";
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
export { checkInput, INJECTION_REMINDER_INSTRUCTION, INPUT_MESSAGE_KEYS } from "./guards/input";
export type { InputCheckResult, InputMessageKey, InputTag } from "./guards/input";
export { checkOutput, createOutputGuard, OUTPUT_MESSAGE_KEYS } from "./guards/output";
export type {
  OutputBlockTag,
  OutputEvent,
  OutputEvidenceInput,
  OutputGuard,
  OutputReplaceKey,
  OutputSummary,
  OutputTag,
} from "./guards/output";
export { postAiChat } from "./endpoint/post";
export type { ChatOutcome, ChatStreamEvent } from "./endpoint/events";
export type { ChatDeps, ChatUsageRecord } from "./endpoint/types";
