import "server-only";
import { getPropertyTool } from "./get-property";
import { listLocalitiesTool } from "./list-localities";
import { searchPropertiesTool } from "./search-properties";
import type { AnyAiChatTool } from "./types";

/**
 * Every tool the assistant may call (ADR-128 section 5.4). The list is fixed in code: at run time the model
 * chooses from it and can add nothing to it. A tool joins the list only if it answers a real customer
 * question, reads only what a visitor may see, takes no person as input, and returns small results; the
 * tests in `__tests__/registry.test.ts` walk this list and fail when one of those stops being true.
 *
 * These three are read tools. The other read tools, the EMI tool and the two propose tools come with their
 * own tasks (P3-T01, P3-T02, P6-T01).
 */
export const AI_CHAT_TOOLS: readonly AnyAiChatTool[] = [
  searchPropertiesTool,
  getPropertyTool,
  listLocalitiesTool,
];
