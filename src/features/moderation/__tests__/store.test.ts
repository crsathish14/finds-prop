import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/types/database.types";

vi.mock("server-only", () => ({}));
vi.mock("@/server/supabase/server", () => ({ createServerSupabase: vi.fn() }));

const { moderationStore } = await import("../service");

const LISTING = "00000000-0000-4000-9000-000000000001";
const answer = { id: LISTING, short_id: "abcd2345", status: "approved", featured: false };

describe("UT-moderation-store: what moderate_listing is sent (S6-T04, ADR-210)", () => {
  const storeWith = () => {
    const rpc = vi.fn(async () => ({ data: [answer], error: null }));
    return { rpc, store: moderationStore({ rpc } as unknown as SupabaseClient<Database>) };
  };

  it("sends no dates when there are none, as before", async () => {
    const { rpc, store } = storeWith();
    await store.decide(LISTING, "feature", null, { featuredFrom: null, featuredUntil: null });
    expect(rpc).toHaveBeenCalledWith("moderate_listing", {
      p_listing: LISTING,
      p_action: "feature",
    });
  });

  it("sends the dates that are given as p_featured_from and p_featured_until", async () => {
    const { rpc, store } = storeWith();
    await store.decide(LISTING, "feature", null, {
      featuredFrom: "2026-12-01",
      featuredUntil: "2026-12-31",
    });
    await store.decide(LISTING, "feature", null, {
      featuredFrom: null,
      featuredUntil: "2026-12-31",
    });
    expect(rpc.mock.calls).toEqual([
      [
        "moderate_listing",
        {
          p_listing: LISTING,
          p_action: "feature",
          p_featured_from: "2026-12-01",
          p_featured_until: "2026-12-31",
        },
      ],
      [
        "moderate_listing",
        { p_listing: LISTING, p_action: "feature", p_featured_until: "2026-12-31" },
      ],
    ]);
  });

  it("answers the listing as the database left it", async () => {
    const { store } = storeWith();
    expect(
      await store.decide(LISTING, "feature", null, {
        featuredFrom: "2999-01-01",
        featuredUntil: null,
      }),
    ).toEqual({ listingId: LISTING, shortId: "abcd2345", status: "approved", featured: false });
  });
});
