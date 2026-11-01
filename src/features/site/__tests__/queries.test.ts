import { beforeEach, describe, expect, it, vi } from "vitest";

const select = vi.fn();
const tag = vi.fn();
const warn = vi.fn();
const error = vi.fn();

vi.mock("next/cache", () => ({ cacheTag: tag, cacheLife: vi.fn() }));
vi.mock("@/server/supabase/public", () => ({
  createPublicSupabase: () => ({ from: () => ({ select }) }),
}));
vi.mock("@/server/logger", () => ({ logger: { warn, error } }));

const { getSiteSettings, SITE_SETTINGS_TAG } = await import("../queries");
const { SITE_DEFAULTS } = await import("../defaults");

describe("UT-site-queries: reading the site content", () => {
  beforeEach(() => vi.clearAllMocks());

  it("tags the read so saving the content can refresh it", async () => {
    select.mockResolvedValue({ data: [], error: null });
    await getSiteSettings();
    expect(tag).toHaveBeenCalledWith(SITE_SETTINGS_TAG);
    expect(SITE_SETTINGS_TAG).toBe("site-settings");
  });

  it("merges the stored rows over the defaults", async () => {
    select.mockResolvedValue({
      data: [{ key: "hero", value: { layout: "split" } }],
      error: null,
    });
    expect((await getSiteSettings()).hero.layout).toBe("split");
  });

  it("falls back to the defaults and logs only the error code when the read fails", async () => {
    select.mockResolvedValue({ data: null, error: { code: "57P01", message: "private detail" } });
    expect(await getSiteSettings()).toEqual(SITE_DEFAULTS);
    expect(error).toHaveBeenCalledWith(expect.any(String), { errorCode: "57P01" });
    expect(JSON.stringify(error.mock.calls)).not.toContain("private detail");
  });
});
