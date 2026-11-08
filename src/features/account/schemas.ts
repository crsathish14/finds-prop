import { z } from "zod";

/** The four tabs of the dashboard, in the order they are shown (FR-ACC-01). */
export const DASHBOARD_TABS = ["saved", "listings", "received", "sent"] as const;

/** `?tab=` : one of the four tabs. Anything else is dropped by the reader (R-FE-11). */
export const dashboardTabSchema = z.enum(DASHBOARD_TABS);

export type DashboardTab = z.infer<typeof dashboardTabSchema>;

/**
 * The number shown on a tab (S6-T03): what it counts, already worded where the word is part of the number
 * ("1 new"), and whether it is drawn as news. A tab with no entry shows no number.
 */
export type TabCount = { value: number | string; tone?: "default" | "new" };
export type TabCounts = Partial<Record<DashboardTab, TabCount>>;
