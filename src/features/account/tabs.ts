import { dashboardTabSchema, type DashboardTab } from "./schemas";

/** Where the dashboard lives. */
export const DASHBOARD_PATH = "/dashboard";

/** The tab shown when the address names none, or names one that does not exist. */
export const DEFAULT_TAB: DashboardTab = "saved";

/**
 * Reads `?tab=` from the page's search params. A missing, repeated-then-invalid or unknown value is
 * dropped and the default tab is shown, with no redirect: the account menu links `?tab=saved`, and
 * the plain `/dashboard` shows the same tab.
 */
export function parseTab(raw: string | string[] | undefined): DashboardTab {
  const first = Array.isArray(raw) ? raw[0] : raw;
  const parsed = dashboardTabSchema.safeParse(first);
  return parsed.success ? parsed.data : DEFAULT_TAB;
}

/** The address of a tab; the default tab has the plain address (defaults are left out, R-FE-11). */
export function tabHref(tab: DashboardTab): string {
  return tab === DEFAULT_TAB ? DASHBOARD_PATH : `${DASHBOARD_PATH}?tab=${tab}`;
}
