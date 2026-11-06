import { z } from "zod";

/** The four tabs of the dashboard, in the order they are shown (FR-ACC-01). */
export const DASHBOARD_TABS = ["saved", "listings", "received", "sent"] as const;

/** `?tab=` : one of the four tabs. Anything else is dropped by the reader (R-FE-11). */
export const dashboardTabSchema = z.enum(DASHBOARD_TABS);

export type DashboardTab = z.infer<typeof dashboardTabSchema>;
