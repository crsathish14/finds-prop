import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/types/database.types";

vi.mock("server-only", () => ({}));
vi.mock("@/server/supabase/server", () => ({ createServerSupabase: vi.fn() }));

const { PLACES_USAGE_DAYS, readPlacesUsage } = await import("../queries");
const { PLACES_CALLERS, toCardUsage } = await import("../places-usage");
const { toPlacesUsage } = await import("../view");

// 20:00 UTC on 17 Nov is already 01:30 on 18 Nov in India.
const NOW = new Date("2026-11-17T20:00:00Z");

/** The 30 days ending on `last`, as the database answers them (a zero for a quiet day). */
function days(last: string, calls: (index: number) => number) {
  const end = Date.parse(`${last}T00:00:00Z`);
  return Array.from({ length: 30 }, (_unused, index) => ({
    day: new Date(end - (29 - index) * 86_400_000).toISOString().slice(0, 10),
    calls: calls(index),
  }));
}

/** What `admin_places_usage` returns (the migration's own shape, `apis` and `problems` included). */
const RAW = {
  total: 6_948,
  today: 212,
  month: 3_100,
  days: days("2026-11-18", (index) => index * 10),
  apis: [{ api: "autocomplete", calls: 6_948 }],
  callers: { search_box: 5_420, listing_form: 1_130, admin_picker: 86, ai_chat: 312 },
  outcomes: { ok: 6_402, empty: 214, timeout: 38, quota: 270, error: 24 },
  problems: 332,
};

/** What the database answers before anything was ever counted. */
const NOTHING = {
  total: 0,
  today: 0,
  month: 0,
  days: days("2026-11-18", () => 0),
  apis: [],
  callers: { search_box: 0, listing_form: 0, admin_picker: 0, ai_chat: 0 },
  outcomes: { ok: 0, empty: 0, timeout: 0, quota: 0, error: 0 },
  problems: 0,
};

function clientAnswering(answer: { data: unknown; error: { code?: string } | null }) {
  const rpc = vi.fn(async () => answer);
  return { client: { rpc } as unknown as SupabaseClient<Database>, rpc };
}

describe("UT-places-usage-view: the card's numbers (PR 6b, ADR-134)", () => {
  it("keeps the thirty days oldest first, the totals, the callers and how the calls ended", () => {
    const usage = toPlacesUsage(RAW);
    expect(usage).not.toBeNull();
    expect(usage?.days).toHaveLength(30);
    expect(usage?.days[0]).toEqual({ day: "2026-10-20", calls: 0 });
    expect(usage?.days[29]).toEqual({ day: "2026-11-18", calls: 290 });
    expect(usage?.today).toBe(212);
    expect(usage?.month).toBe(3_100);
    expect(usage?.callers).toEqual(RAW.callers);
    expect(usage?.outcomes).toEqual(RAW.outcomes);
  });

  it("says no calls yet (null) when nothing is counted in the thirty days, today or this month", () => {
    expect(toPlacesUsage(NOTHING)).toBeNull();
  });

  it("still draws the card when only this month has calls (the month can start before the thirty days)", () => {
    expect(toPlacesUsage({ ...NOTHING, month: 4 })).not.toBeNull();
    expect(toPlacesUsage({ ...NOTHING, total: 1 })).not.toBeNull();
    expect(toPlacesUsage({ ...NOTHING, today: 1 })).not.toBeNull();
  });

  it("refuses an object that is not in the expected shape, instead of drawing half a card", () => {
    expect(() => toPlacesUsage(null)).toThrow();
    expect(() => toPlacesUsage({ ...RAW, days: undefined })).toThrow();
    expect(() => toPlacesUsage({ ...RAW, callers: { search_box: 1 } })).toThrow();
    expect(() => toPlacesUsage({ ...RAW, outcomes: { ...RAW.outcomes, ok: -1 } })).toThrow();
    expect(() => toPlacesUsage({ ...RAW, today: 1.5 })).toThrow();
    expect(() => toPlacesUsage({ ...RAW, days: [{ day: "18 Nov", calls: 1 }] })).toThrow();
  });
});

describe("UT-places-usage-card-mapping: the card's labels (PR 6b, ADR-134)", () => {
  const usage = toPlacesUsage(RAW);
  if (usage === null) throw new Error("the example has calls");
  const callerName: Record<string, string> = {
    search_box: "Search box",
    listing_form: "Post form",
    admin_picker: "Admin pickers",
    ai_chat: "AI chat",
  };
  const card = toCardUsage(usage, "en", (caller) => callerName[caller] ?? caller);

  it("names each day the way the Overview's own chart does, with and without the year", () => {
    expect(card.days).toHaveLength(30);
    expect(card.days[0]).toEqual({ label: "20 Oct", detailLabel: "20 Oct 2026", calls: 0 });
    expect(card.days[12]).toMatchObject({ label: "1 Nov", detailLabel: "1 Nov 2026" });
    expect(card.days[29]).toEqual({ label: "18 Nov", detailLabel: "18 Nov 2026", calls: 290 });
  });

  it("lists the four callers in the card's order with their names and counts", () => {
    expect(PLACES_CALLERS).toEqual(["search_box", "listing_form", "admin_picker", "ai_chat"]);
    expect(card.callers).toEqual([
      { id: "search_box", label: "Search box", calls: 5_420 },
      { id: "listing_form", label: "Post form", calls: 1_130 },
      { id: "admin_picker", label: "Admin pickers", calls: 86 },
      { id: "ai_chat", label: "AI chat", calls: 312 },
    ]);
  });

  it("carries today, the month and the five outcomes through as they are", () => {
    expect(card.today).toBe(212);
    expect(card.month).toBe(3_100);
    expect(card.outcomes).toEqual({ ok: 6_402, empty: 214, timeout: 38, quota: 270, error: 24 });
  });
});

describe("UT-places-usage-queries: reading the numbers (PR 6b, ADR-134)", () => {
  it("asks the database for the last 30 India days, today included, and returns the numbers", async () => {
    const { client, rpc } = clientAnswering({ data: RAW, error: null });
    const usage = await readPlacesUsage(client, NOW);
    // 20:00 UTC on 17 Nov is 18 Nov in India; 30 days counting both ends start on 20 Oct.
    expect(PLACES_USAGE_DAYS).toBe(30);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("admin_places_usage", {
      p_from: "2026-10-20",
      p_to: "2026-11-18",
    });
    expect(usage?.today).toBe(212);
  });

  it("returns null when no call has ever been made", async () => {
    const { client } = clientAnswering({ data: NOTHING, error: null });
    await expect(readPlacesUsage(client, NOW)).resolves.toBeNull();
  });

  it("throws the database's error, so the page can show the failed block", async () => {
    const { client } = clientAnswering({ data: null, error: { code: "42501" } });
    await expect(readPlacesUsage(client, NOW)).rejects.toMatchObject({ code: "42501" });
  });

  it("throws when the answer is not in the expected shape", async () => {
    const { client } = clientAnswering({ data: { total: 1 }, error: null });
    await expect(readPlacesUsage(client, NOW)).rejects.toBeDefined();
  });
});
