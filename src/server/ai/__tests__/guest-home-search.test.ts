import { beforeEach, describe, expect, it, vi } from "vitest";

// UT-ai-guest-homes (ADR-171): the one service-role read a guest's assistant search makes. It calls only the server-only
// function, with the service-role client, and never asks for more than ten homes.
const rpc = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("../../supabase/admin.server", () => ({ createAdminSupabase: () => ({ rpc }) }));

const { guestSearchHomes, GUEST_HOMES_MAX } = await import("../guest-home-search");

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: [], error: null });
});

describe("UT-ai-guest-homes: the guest's narrow read", () => {
  it("calls guest_search_properties and nothing else", async () => {
    await guestSearchHomes({ p_sort: "newest", p_locality: "Adyar", p_limit: 5 });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("guest_search_properties", {
      p_sort: "newest",
      p_locality: "Adyar",
      p_limit: 5,
    });
  });

  it("never asks for more than ten homes, and asks for ten when no limit is given", async () => {
    await guestSearchHomes({ p_limit: 120 });
    await guestSearchHomes({});
    await guestSearchHomes({ p_limit: 0 });
    expect(rpc.mock.calls.map((call) => (call[1] as { p_limit: number }).p_limit)).toEqual([
      GUEST_HOMES_MAX,
      GUEST_HOMES_MAX,
      1,
    ]);
    expect(GUEST_HOMES_MAX).toBe(10);
  });
});
