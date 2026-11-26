import "server-only";
import { calculateEmiTool } from "./calculate-emi";
import { compareHomesTool } from "./compare-properties";
import { compareProjectsTool } from "./compare-projects";
import { getBuilderTool } from "./get-builder";
import { getContentItemTool } from "./get-content-item";
import { getProjectTool } from "./get-project";
import { getPropertyTool } from "./get-property";
import { listLocalitiesTool } from "./list-localities";
import { proposeEnquiryTool } from "./propose-enquiry";
import { proposeProjectEnquiryTool } from "./propose-project-enquiry";
import type { PlaceLookup } from "./place-lookup";
import { proposeSiteVisitTool } from "./propose-site-visit";
import { searchContentTool } from "./search-content";
import { searchJobsTool } from "./search-jobs";
import { searchProjectsTool } from "./search-projects";
import { createSearchPropertiesTool, searchPropertiesTool } from "./search-properties";
import type { AnyAiChatTool } from "./types";

/** The fourteen tools that do not depend on place search, in the order the model is shown them after `search_properties`. */
const OTHER_TOOLS: readonly AnyAiChatTool[] = [
  getPropertyTool,
  listLocalitiesTool,
  searchProjectsTool,
  getProjectTool,
  getBuilderTool,
  compareHomesTool,
  compareProjectsTool,
  calculateEmiTool,
  searchContentTool,
  searchJobsTool,
  getContentItemTool,
  proposeEnquiryTool,
  proposeProjectEnquiryTool,
  proposeSiteVisitTool,
];

/**
 * Every tool the assistant may call (ADR-128 section 5.4). The list is fixed in code: at run time the model
 * chooses from it and can add nothing to it. A tool joins the list only if it answers a real customer
 * question, reads only what a visitor may see, takes no person as input, and returns small results; the
 * tests in `__tests__/registry.test.ts` walk this list and fail when one of those stops being true.
 *
 * The first twelve are read tools (`calculate_emi` reads nothing: it is pure maths, and may run beside other
 * calls; `search_content`, `search_jobs` and `get_content_item` read the published articles, questions and open jobs of
 * the Blog, the FAQ and Careers, ADR-143 section 6, and share 2 of the 6 calls of a message). The last three are propose tools (ADR-128 section 5.3, ADR-176): they write nothing, always run alone in their
 * round, and are the only tools that look at who is asking, which they read from the server-side session and
 * never from the model. The model-supplied input of every tool still names no person.
 *
 * Two lists are served (ADR-142). `createAiChatTools()` is the list that has always existed, and `AI_CHAT_TOOLS` is that
 * list: its `search_properties` takes no place. `createAiChatTools(placeLookup)` swaps in the place-aware
 * `search_properties` and leaves the other fourteen as they are; the endpoint builds it only while
 * `FLAG_AI_PLACE_SEARCH` and `FLAG_AI_SEARCH` are both on.
 */
export function createAiChatTools(placeLookup?: PlaceLookup): readonly AnyAiChatTool[] {
  return [
    placeLookup === undefined ? searchPropertiesTool : createSearchPropertiesTool(placeLookup),
    ...OTHER_TOOLS,
  ];
}

/**
 * The tools while `FLAG_AI_PLACE_SEARCH` is off, which is how they were before AI place search existed: the search
 * tool takes no place (ADR-142). With the flag on, `createAiChatTools(placeLookup)` swaps in the place-aware one.
 */
export const AI_CHAT_TOOLS: readonly AnyAiChatTool[] = createAiChatTools();
