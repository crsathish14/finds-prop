import "server-only";
import { calculateEmiTool } from "./calculate-emi";
import { compareHomesTool } from "./compare-properties";
import { getBuilderTool } from "./get-builder";
import { getProjectTool } from "./get-project";
import { getPropertyTool } from "./get-property";
import { listLocalitiesTool } from "./list-localities";
import { proposeEnquiryTool } from "./propose-enquiry";
import { proposeSiteVisitTool } from "./propose-site-visit";
import { searchProjectsTool } from "./search-projects";
import { searchPropertiesTool } from "./search-properties";
import type { AnyAiChatTool } from "./types";

/**
 * Every tool the assistant may call (ADR-128 section 5.4). The list is fixed in code: at run time the model
 * chooses from it and can add nothing to it. A tool joins the list only if it answers a real customer
 * question, reads only what a visitor may see, takes no person as input, and returns small results; the
 * tests in `__tests__/registry.test.ts` walk this list and fail when one of those stops being true.
 *
 * The first eight are read tools (`calculate_emi` reads nothing: it is pure maths, and may run beside other
 * calls). The last two are propose tools (ADR-128 section 5.3): they write nothing, always run alone in their
 * round, and are the only tools that look at who is asking, which they read from the server-side session and
 * never from the model. The model-supplied input of every tool still names no person.
 */
export const AI_CHAT_TOOLS: readonly AnyAiChatTool[] = [
  searchPropertiesTool,
  getPropertyTool,
  listLocalitiesTool,
  searchProjectsTool,
  getProjectTool,
  getBuilderTool,
  compareHomesTool,
  calculateEmiTool,
  proposeEnquiryTool,
  proposeSiteVisitTool,
];
