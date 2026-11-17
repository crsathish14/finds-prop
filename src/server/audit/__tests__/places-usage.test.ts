import { beforeEach, describe, expect, it, vi } from "vitest";

// UT-places-usage (ADR-134, ADR-133 update): the writer behind the place search count. It sends three closed values
// to the service-only `record_places_call()` and nothing else, and it never throws or logs a value.

const { rpc, createAdminSupabase, warn } = vi.hoisted(() => ({
  rpc: vi.fn(),
  createAdminSupabase: vi.fn(),
  warn: vi.fn(),
}));
vi.mock("@/server/supabase/admin.server", () => ({
  createAdminSupabase: (requestId?: string) => createAdminSupabase(requestId) as unknown,
}));
vi.mock("@/server/logger", () => ({ logger: { warn } }));

import { writePlacesUsage, type PlacesUsageRecord } from "@/server/audit/places-usage";

const record: PlacesUsageRecord = { api: "autocomplete", caller: "search_box", outcome: "ok" };
const TYPED = "Zanzibar Quarter Secret";

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ error: null });
  createAdminSupabase.mockReset().mockReturnValue({ rpc });
  warn.mockReset();
});

describe("UT-places-usage: writePlacesUsage", () => {
  it("calls record_places_call through the service role with exactly the three values, and logs nothing", async () => {
    await writePlacesUsage(record, "req-places-0001");
    expect(createAdminSupabase).toHaveBeenCalledWith("req-places-0001");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("record_places_call", {
      p_api: "autocomplete",
      p_caller: "search_box",
      p_outcome: "ok",
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it("sends every outcome and caller as given", async () => {
    await writePlacesUsage({ api: "autocomplete", caller: "admin_picker", outcome: "quota" });
    expect(rpc).toHaveBeenCalledWith("record_places_call", {
      p_api: "autocomplete",
      p_caller: "admin_picker",
      p_outcome: "quota",
    });
  });

  it("has no way to carry text: only the three arguments reach the database, whatever else is passed", async () => {
    await writePlacesUsage({
      ...record,
      text: TYPED,
      placeName: "KK Nagar",
      visitorHash: "abc123",
      userId: "user-1",
      address: "Anna Salai",
    } as PlacesUsageRecord);
    const args = rpc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(Object.keys(args).sort()).toEqual(["p_api", "p_caller", "p_outcome"]);
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("Zanzibar");
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("KK Nagar");
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("user-1");
  });

  it("never throws when the function refuses the call, and logs one line with no value", async () => {
    rpc.mockResolvedValue({ error: { message: `bad value ${TYPED}`, code: "22023" } });
    await expect(writePlacesUsage(record, "req-places-0002")).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("places usage write failed", {
      route: "places-usage",
      requestId: "req-places-0002",
      reason: "rejected",
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("Zanzibar");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("autocomplete");
  });

  it("never throws when the call rejects, and logs only the error's class name", async () => {
    rpc.mockRejectedValue(new TypeError(`network failed for ${TYPED}`));
    await expect(writePlacesUsage(record)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("places usage write failed", {
      route: "places-usage",
      reason: "unreachable",
      errorName: "TypeError",
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("Zanzibar");
  });

  it("never throws when the service role is not configured (the client cannot be made)", async () => {
    createAdminSupabase.mockImplementation(() => {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
    });
    await expect(writePlacesUsage(record)).resolves.toBeUndefined();
    expect(rpc).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
