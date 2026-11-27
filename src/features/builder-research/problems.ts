import type { PageProblem } from "./reader.server";

/** Why a page could not be read, and its words under `builderResearch.problem` (the owner's approved sentences). */
export const PAGE_PROBLEMS: readonly PageProblem[] = [
  "not_on_site",
  "could_not_open",
  "blocked",
  "not_a_page",
  "too_little_text",
];

export const PROBLEM_KEYS: Readonly<Record<PageProblem, string>> = {
  not_on_site: "notOnSite",
  could_not_open: "couldNotOpen",
  blocked: "blocked",
  not_a_page: "notAPage",
  too_little_text: "tooLittleText",
};
