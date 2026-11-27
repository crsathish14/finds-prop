import { STATUS_MESSAGE_KEYS, type StatusMessageKey } from "./tools/types";

/**
 * Which status line the chat window shows for the tools a round runs (ADR-217). The first tool asked that has a line
 * of its own decides; any other tool (one home, a comparison, an EMI sum, a proposal) keeps the plain "Searching…".
 */
const LINE_OF_TOOL: Readonly<Record<string, StatusMessageKey>> = {
  search_properties: STATUS_MESSAGE_KEYS.homes,
  search_projects: STATUS_MESSAGE_KEYS.homes,
  search_content: STATUS_MESSAGE_KEYS.articles,
  get_content_item: STATUS_MESSAGE_KEYS.articles,
  search_jobs: STATUS_MESSAGE_KEYS.articles,
  get_builder: STATUS_MESSAGE_KEYS.builders,
  research_builder: STATUS_MESSAGE_KEYS.builders,
  search_web: STATUS_MESSAGE_KEYS.web,
};

export function statusLineFor(tools: readonly string[]): StatusMessageKey {
  for (const tool of tools) {
    const line = LINE_OF_TOOL[tool];
    if (line !== undefined) return line;
  }
  return STATUS_MESSAGE_KEYS.searching;
}
