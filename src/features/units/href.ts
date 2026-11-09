import type { UnitStateFilter } from "./constants";

/** Where the admin's Units page lives. */
export const UNITS_PATH = "/admin/units";

/** Where the builder's Units page lives (S7-T03). */
export const BUILDER_UNITS_PATH = "/builder/units";

/**
 * The address of the Units page for some choices: the project, the state chip and a unit number to look for, on the
 * admin's page unless another path is given (the builder's, S7-T03). What
 * is the default (all states, nothing typed) is left out of the address (R-FE-11), and the page cursor is never in
 * it: "Show more" adds rows to the page in place.
 */
export function unitsHref(
  choice: {
    projectId: string;
    state: UnitStateFilter;
    search?: string | undefined;
  },
  path: string = UNITS_PATH,
): string {
  const query = new URLSearchParams({ project: choice.projectId });
  if (choice.state !== "all") query.set("state", choice.state);
  if (choice.search) query.set("search", choice.search);
  return `${path}?${query.toString()}`;
}
