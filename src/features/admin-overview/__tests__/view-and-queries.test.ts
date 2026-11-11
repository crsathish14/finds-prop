import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/types/database.types";

vi.mock("server-only", () => ({}));
vi.mock("@/server/supabase/server", () => ({ createServerSupabase: vi.fn() }));

const { readAdminOverview } = await import("../queries");
const { agoOf, conversionOf, toOverview } = await import("../view");

// 12:00 UTC on 10 Nov is 17:30 in India.
const NOW = new Date("2026-11-10T12:00:00Z");

const RAW = {
  listings: { total: 248, approved: 196, pending: 14 },
  people: { customers: 1284, agents: 7, builders: 12 },
  leads: { leads: 8, enquiries: 5, shortlists: 3, visitors: 125 },
  new_today: 2,
  sources: { project_pages: 5, property_enquiries: 2, other_forms: 1 },
  daily: [
    { day: "2026-11-09", leads: 3, enquiries: 2, shortlists: 1 },
    { day: "2026-11-10", leads: 0, enquiries: 0, shortlists: 0 },
  ],
  top_projects: [{ id: "p1", slug: "kadal-vista", name: "Kadal Vista", enquiries: 2 }],
  recent: [
    {
      id: "l1",
      source: "project",
      kind: "enquiry",
      name: "Arjun Menon",
      label: "Kadal Vista",
      created_at: "2026-11-10T11:48:00Z",
    },
    {
      id: "l2",
      source: "form",
      kind: null,
      name: null,
      label: "Contact page",
      created_at: "2026-11-09T06:00:00Z",
    },
  ],
};

function clientAnswering(answer: { data: unknown; error: { code?: string } | null }) {
  const rpc = vi.fn(async () => answer);
  return { client: { rpc } as unknown as SupabaseClient<Database>, rpc };
}

describe("UT-overview-view: the numbers the page draws (S7-T06 part 3)", () => {
  it("turns the object from the database into the screen's numbers", () => {
    const overview = toOverview(RAW, NOW);
    expect(overview.listings).toEqual({ total: 248, approved: 196, pending: 14 });
    expect(overview.people).toEqual({ customers: 1284, agents: 7, builders: 12 });
    expect(overview.leads).toEqual({
      total: 8,
      enquiries: 5,
      shortlists: 3,
      visitors: 125,
      today: 2,
    });
    expect(overview.sources).toEqual({ projectPages: 5, propertyEnquiries: 2, otherForms: 1 });
    expect(overview.daily).toHaveLength(2);
    expect(overview.topProjects).toEqual([{ id: "p1", name: "Kadal Vista", enquiries: 2 }]);
    expect(overview.recent[0]).toEqual({
      id: "l1",
      source: "project",
      kind: "enquiry",
      name: "Arjun Menon",
      label: "Kadal Vista",
      ago: { unit: "minutes", count: 12 },
    });
    expect(overview.recent[1]).toMatchObject({ source: "form", kind: null, name: null });
    expect(overview.active).toBe(true);
  });

  it("works out the conversion as leads for every hundred visitors, to one decimal", () => {
    expect(toOverview(RAW, NOW).conversion).toBe(6.4);
    expect(conversionOf(862, 13_469)).toBe(6.4);
    expect(conversionOf(3, 7)).toBe(42.9);
    expect(conversionOf(10, 8)).toBe(125);
  });

  it("has no conversion when nobody visited, rather than dividing by zero", () => {
    expect(conversionOf(5, 0)).toBeNull();
    expect(conversionOf(0, 0)).toBeNull();
  });

  it("says nothing happened when every day of the range is zero", () => {
    const quiet = toOverview(
      {
        ...RAW,
        daily: RAW.daily.map((entry) => ({ ...entry, leads: 0, enquiries: 0, shortlists: 0 })),
      },
      NOW,
    );
    expect(quiet.active).toBe(false);
    expect(toOverview({ ...RAW, daily: [] }, NOW).active).toBe(false);
  });

  it("refuses an object that is not in the expected shape, instead of drawing half a page", () => {
    expect(() => toOverview({ ...RAW, listings: undefined }, NOW)).toThrow();
    expect(() => toOverview(null, NOW)).toThrow();
    expect(() => toOverview({ ...RAW, leads: { ...RAW.leads, leads: -1 } }, NOW)).toThrow();
    expect(() => toOverview({ ...RAW, leads: { ...RAW.leads, leads: 1.5 } }, NOW)).toThrow();
    expect(() =>
      toOverview({ ...RAW, recent: [{ ...RAW.recent[0], source: "phone" }] }, NOW),
    ).toThrow();
    expect(() =>
      toOverview({ ...RAW, daily: [{ ...RAW.daily[0], day: "10 Nov" }] }, NOW),
    ).toThrow();
  });
});

describe("UT-overview-ago: how long ago a lead came (S7-T06 part 3)", () => {
  const ago = (created: string) => agoOf(created, NOW);

  it("says just now for the first minute, and for a clock a little ahead", () => {
    expect(ago("2026-11-10T11:59:30Z")).toEqual({ unit: "now" });
    expect(ago("2026-11-10T12:00:00Z")).toEqual({ unit: "now" });
    expect(ago("2026-11-10T12:05:00Z")).toEqual({ unit: "now" });
  });

  it("counts minutes up to an hour, then hours up to a day", () => {
    expect(ago("2026-11-10T11:59:00Z")).toEqual({ unit: "minutes", count: 1 });
    expect(ago("2026-11-10T11:00:01Z")).toEqual({ unit: "minutes", count: 59 });
    expect(ago("2026-11-10T11:00:00Z")).toEqual({ unit: "hours", count: 1 });
    expect(ago("2026-11-09T12:01:00Z")).toEqual({ unit: "hours", count: 23 });
  });

  it("says yesterday from a day on, by the day in India", () => {
    expect(ago("2026-11-09T12:00:00Z")).toEqual({ unit: "yesterday" });
    expect(ago("2026-11-09T01:00:00Z")).toEqual({ unit: "yesterday" });
  });

  it("counts days up to thirty, then names the date in India", () => {
    expect(ago("2026-11-07T12:00:00Z")).toEqual({ unit: "days", count: 3 });
    expect(ago("2026-10-11T12:00:00Z")).toEqual({ unit: "days", count: 30 });
    expect(ago("2026-10-10T12:00:00Z")).toEqual({ unit: "date", day: "2026-10-10" });
    // 19:00 UTC on 30 Sep is already 1 Oct in India.
    expect(ago("2026-09-30T19:00:00Z")).toEqual({ unit: "date", day: "2026-10-01" });
  });

  it("gives an empty date for a time that is not a date", () => {
    expect(ago("not a time")).toEqual({ unit: "date", day: "" });
  });
});

describe("UT-overview-queries: reading the numbers (S7-T06 part 3)", () => {
  it("asks the database for the two days and returns the screen's numbers", async () => {
    const { client, rpc } = clientAnswering({ data: RAW, error: null });
    const overview = await readAdminOverview(client, { from: "2026-11-09", to: "2026-11-10" }, NOW);
    expect(rpc).toHaveBeenCalledWith("admin_overview", {
      p_from: "2026-11-09",
      p_to: "2026-11-10",
    });
    expect(overview.leads.total).toBe(8);
  });

  it("throws the database's error, so the page can say the read failed", async () => {
    const { client } = clientAnswering({ data: null, error: { code: "42501" } });
    await expect(
      readAdminOverview(client, { from: "2026-11-09", to: "2026-11-10" }, NOW),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("throws when the answer is not in the expected shape", async () => {
    const { client } = clientAnswering({ data: { listings: {} }, error: null });
    await expect(
      readAdminOverview(client, { from: "2026-11-09", to: "2026-11-10" }, NOW),
    ).rejects.toBeDefined();
  });
});
