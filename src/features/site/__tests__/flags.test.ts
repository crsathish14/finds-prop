import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/env", () => ({
  env: { FLAG_AI_SEARCH: true, FLAG_MAP_VIEW: false, FLAG_PG_LISTINGS: false },
}));

const { getFeatureFlags } = await import("../flags");

describe("UT-site-flags: feature flags", () => {
  it("reports each flag from the environment", () => {
    expect(getFeatureFlags()).toEqual({ aiSearch: true, mapView: false, pgListings: false });
  });
});
