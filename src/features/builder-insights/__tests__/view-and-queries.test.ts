import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/types/database.types";

vi.mock("server-only", () => ({}));
vi.mock("@/server/supabase/server", () => ({ createServerSupabase: vi.fn() }));

const { readBuilderInsights } = await import("../queries");
const { pendingNotice, toInsightsNumbers } = await import("../view");

const ROW = {
  projects: 2,
  active_projects: 1,
  total_units: 5,
  available_units: 3,
  sold_units: 1,
  views: 5,
  visitors: 4,
  shortlists: 1,
  comparisons: 1,
  brochures: 1,
  calls: 1,
  whatsapp: 1,
  enquiries: 3,
  leads: 5,
  site_visits: 1,
};

function clientAnswering(answer: { data: unknown; error: { code?: string } | null }) {
  const rpc = vi.fn(async () => answer);
  return { client: { rpc } as unknown as SupabaseClient<Database>, rpc };
}

describe("UT-insights-view: the numbers and the notice (S7-T03 step E)", () => {
  it("turns the one row from the database into the screen's numbers", () => {
    expect(toInsightsNumbers([ROW])).toEqual({
      projects: 2,
      activeProjects: 1,
      totalUnits: 5,
      availableUnits: 3,
      soldUnits: 1,
      views: 5,
      visitors: 4,
      shortlists: 1,
      comparisons: 1,
      brochures: 1,
      calls: 1,
      whatsapp: 1,
      enquiries: 3,
      leads: 5,
      siteVisits: 1,
    });
  });

  it.each([
    ["no row", []],
    ["nothing", null],
    ["a count that is not a number", [{ ...ROW, views: "5" }]],
    ["a negative count", [{ ...ROW, leads: -1 }]],
    ["a missing count", [{ ...ROW, calls: undefined }]],
  ])("refuses %s, so a wrong answer is a failed read and not a page of zeros", (_why, rows) => {
    expect(() => toInsightsNumbers(rows)).toThrow();
  });

  it("counts the projects waiting for approval and names the one when there is exactly one", () => {
    expect(pendingNotice([])).toEqual({ count: 0, name: null });
    expect(
      pendingNotice([
        { name: "Kadal Vista", moderation: "approved" },
        { name: "Nila Grove", moderation: "pending" },
        { name: "Old Draft", moderation: "draft" },
      ]),
    ).toEqual({ count: 1, name: "Nila Grove" });
    expect(
      pendingNotice([
        { name: "Tower A", moderation: "pending" },
        { name: "Tower B", moderation: "pending" },
      ]),
    ).toEqual({ count: 2, name: null });
  });
});

describe("UT-insights-queries: reading the numbers as the builder (S7-T03 step E)", () => {
  it("asks the database for the days, and for a project only when one is chosen", async () => {
    const all = clientAnswering({ data: [ROW], error: null });
    await readBuilderInsights(all.client, { from: "2026-10-01", to: "2026-10-31" });
    expect(all.rpc).toHaveBeenCalledWith("builder_insights", {
      p_from: "2026-10-01",
      p_to: "2026-10-31",
    });
    const one = clientAnswering({ data: [ROW], error: null });
    await readBuilderInsights(one.client, { from: "2026-10-01", to: "2026-10-31" }, "p1");
    expect(one.rpc).toHaveBeenCalledWith("builder_insights", {
      p_from: "2026-10-01",
      p_to: "2026-10-31",
      p_project: "p1",
    });
  });

  it("throws when the database says no, so the portal's error page shows it", async () => {
    const refused = clientAnswering({ data: null, error: { code: "42501" } });
    await expect(
      readBuilderInsights(refused.client, { from: "2026-10-01", to: "2026-10-31" }),
    ).rejects.toMatchObject({ code: "42501" });
  });
});
