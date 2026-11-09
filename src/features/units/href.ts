import type { UnitStateFilter } from "./constants";

/** Where the admin's Units page lives. */
export const UNITS_PATH = "/admin/units";

/**
 * The address of the Units page for some choices: the project, the state chip and a unit number to look for. What
 * is the default (all states, nothing typed) is left out of the address (R-FE-11), and the page cursor is never in
 * it: "Show more" adds rows to the page in place.
 */
export function unitsHref(choice: {
  projectId: string;
  state: UnitStateFilter;
  search?: string | undefined;
}): string {
  const query = new URLSearchParams({ project: choice.projectId });
  if (choice.state !== "all") query.set("state", choice.state);
  if (choice.search) query.set("search", choice.search);
  return `${UNITS_PATH}?${query.toString()}`;
}
