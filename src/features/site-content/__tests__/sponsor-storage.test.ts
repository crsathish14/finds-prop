import { beforeEach, describe, expect, it, vi } from "vitest";

const bucket = vi.hoisted(() => ({ upload: vi.fn(), remove: vi.fn(), from: vi.fn() }));
vi.mock("@/server/supabase/browser", () => ({
  createBrowserSupabase: () => ({ storage: { from: bucket.from } }),
}));

const { createSponsorStorage } = await import("../sponsor-storage");

beforeEach(() => {
  vi.clearAllMocks();
  bucket.from.mockReturnValue({ upload: bucket.upload, remove: bucket.remove });
});

describe("UT-sponsor-storage: the public bucket from the browser (S7-T11)", () => {
  it("sends a file to the site's public bucket with its own type, a year of caching and no overwriting", async () => {
    bucket.upload.mockResolvedValue({ error: null });
    const file = new File(["x"], "a.webp", { type: "image/webp" });
    expect(await createSponsorStorage().upload("sponsors/a/b.webp", file)).toBe(true);
    expect(bucket.from).toHaveBeenCalledWith("site-assets");
    expect(bucket.upload).toHaveBeenCalledWith("sponsors/a/b.webp", file, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: false,
    });
  });

  it("says false when the bucket refuses or the call throws", async () => {
    bucket.upload.mockResolvedValueOnce({ error: { message: "no" } });
    const file = new File(["x"], "a.png", { type: "image/png" });
    expect(await createSponsorStorage().upload("sponsors/a/b.png", file)).toBe(false);
    bucket.upload.mockRejectedValueOnce(new Error("offline"));
    expect(await createSponsorStorage().upload("sponsors/a/b.png", file)).toBe(false);
  });

  it("takes files away, does nothing for an empty list, and never throws", async () => {
    bucket.remove.mockResolvedValue({ error: null });
    await createSponsorStorage().remove([]);
    expect(bucket.remove).not.toHaveBeenCalled();
    await createSponsorStorage().remove(["sponsors/a/b.png"]);
    expect(bucket.remove).toHaveBeenCalledWith(["sponsors/a/b.png"]);
    bucket.remove.mockRejectedValueOnce(new Error("offline"));
    await expect(createSponsorStorage().remove(["sponsors/a/c.png"])).resolves.toBeUndefined();
  });
});
